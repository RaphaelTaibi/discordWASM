use std::collections::{HashMap, HashSet};
use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::ConnectInfo;
use axum::response::IntoResponse;
use axum::Extension;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;

use super::broadcast::{broadcast_to_channel, remove_peer, serialize_message};
use super::models::{ClientMessage, PeerInfo, ServerMessage};
use super::negotiation;
use super::state::{AppState, ChannelState, PeerSession, RTCPStats, WS_CHANNEL_CAPACITY};
use crate::fraud::FraudState;
use crate::metrics::WS_QUEUE_DROPPED;

/// Axum WebSocket upgrade handler.
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
    fraud: Option<Extension<FraudState>>,
) -> impl IntoResponse {
    let ip = addr.ip().to_string();
    let fraud_state = fraud.map(|Extension(f)| f);
    ws.on_upgrade(move |socket| handle_socket(socket, state, ip, fraud_state))
}

/// Manages a single peer's WebSocket lifecycle.
async fn handle_socket(
    socket: WebSocket,
    state: Arc<AppState>,
    ip: String,
    fraud_state: Option<FraudState>,
) {
    let (mut socket_sender, mut socket_receiver) = socket.split();
    let (tx, mut rx) = mpsc::channel::<String>(WS_CHANNEL_CAPACITY);
    let mut current_user_id: Option<String> = None;

    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if socket_sender.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(message)) = socket_receiver.next().await {
        let text = match message {
            Message::Text(t) => t,
            Message::Close(_) => break,
            _ => continue,
        };

        let msg = match serde_json::from_str::<ClientMessage>(&text) {
            Ok(m) => m,
            Err(_) => continue,
        };

        match msg {
            ClientMessage::Join {
                channel_id,
                user_id,
                username,
                fingerprint,
            } => {
                if let (Some(fp), Some(fs)) = (&fingerprint, &fraud_state) {
                    fs.bans.record_fingerprint(fp, &ip);
                }
                handle_join(&state, &tx, &mut current_user_id, channel_id, user_id, username)
                    .await;
            }

            ClientMessage::Offer { sdp } => {
                negotiation::handle_offer(&state, &tx, &current_user_id, sdp).await;
            }

            ClientMessage::Answer { sdp } => {
                negotiation::handle_answer(&state, &current_user_id, sdp).await;
            }

            ClientMessage::Ice { candidate } => {
                negotiation::handle_ice(&state, &current_user_id, candidate).await;
            }

            ClientMessage::MediaState {
                channel_id,
                user_id,
                is_muted,
                is_deafened,
            } => {
                let uid_for_exclude = user_id.clone();
                if let Some(peer) = state.peers.write().await.get_mut(&user_id) {
                    peer.is_muted = is_muted;
                    peer.is_deafened = is_deafened;
                }
                broadcast_to_channel(
                    &state,
                    &channel_id,
                    &ServerMessage::PeerState {
                        channel_id: channel_id.clone(),
                        user_id,
                        is_muted,
                        is_deafened,
                    },
                    Some(uid_for_exclude.as_str()),
                )
                .await;
            }

            ClientMessage::Chat {
                channel_id,
                from,
                username,
                message,
                timestamp,
            } => {
                broadcast_to_channel(
                    &state,
                    &channel_id,
                    &ServerMessage::Chat {
                        channel_id: channel_id.clone(),
                        from,
                        username,
                        message,
                        timestamp,
                    },
                    None,
                )
                .await;
            }

            ClientMessage::Leave { .. } => {
                if let Some(uid) = current_user_id.take() {
                    remove_peer(&state, &uid).await;
                }
            }
        }
    }

    if let Some(user_id) = current_user_id {
        remove_peer(&state, &user_id).await;
    }
    send_task.abort();
}

/// Processes a Join message: registers the peer, notifies the channel.
async fn handle_join(
    state: &Arc<AppState>,
    tx: &mpsc::Sender<String>,
    current_user_id: &mut Option<String>,
    channel_id: String,
    user_id: String,
    username: String,
) {
    if let Some(old_id) = current_user_id.take() {
        remove_peer(state, &old_id).await;
    }

    let (existing_peers, started_at) = {
        let mut channels = state.channels.write().await;
        let channel = channels
            .entry(channel_id.clone())
            .or_insert_with(|| ChannelState {
                members: HashSet::new(),
                forwarders: HashMap::new(),
                stats: HashMap::new(),
                started_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
            });
        let peers = state.peers.read().await;
        let existing = channel
            .members
            .iter()
            .filter_map(|m_id| {
                peers.get(m_id).map(|p| PeerInfo {
                    user_id: p.user_id.clone(),
                    username: p.username.clone(),
                    is_muted: p.is_muted,
                    is_deafened: p.is_deafened,
                })
            })
            .collect::<Vec<PeerInfo>>();
        (existing, channel.started_at)
    };

    state.peers.write().await.insert(
        user_id.clone(),
        PeerSession {
            user_id: user_id.clone(),
            username: username.clone(),
            channel_id: channel_id.clone(),
            tx: tx.clone(),
            is_muted: false,
            is_deafened: false,
            peer_connection: None,
        },
    );

    {
        let mut channels = state.channels.write().await;
        if let Some(channel) = channels.get_mut(&channel_id) {
            channel.members.insert(user_id.clone());
            channel.stats.insert(user_id.clone(), RTCPStats::new());
        }
    }

    if let Some(payload) = serialize_message(&ServerMessage::Joined {
        channel_id: channel_id.clone(),
        peers: existing_peers,
        started_at,
    }) {
        if tx.try_send(payload).is_err() {
            WS_QUEUE_DROPPED.inc();
        }
    }

    broadcast_to_channel(
        state,
        &channel_id,
        &ServerMessage::PeerJoined {
            channel_id: channel_id.clone(),
            peer: PeerInfo {
                user_id: user_id.clone(),
                username,
                is_muted: false,
                is_deafened: false,
            },
        },
        Some(&user_id),
    )
    .await;

    *current_user_id = Some(user_id);
}
