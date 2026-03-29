use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
    Router,
};

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::{mpsc, Mutex};
use tower_http::cors::CorsLayer;

struct AppState {
    peers: Mutex<HashMap<String, PeerSession>>,
    channels: Mutex<HashMap<String, Vec<String>>>,
}

#[derive(Clone)]
struct PeerSession {
    user_id: String,
    username: String,
    channel_id: String,
    tx: mpsc::UnboundedSender<String>,
    is_muted: bool,
    is_deafened: bool,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
enum ClientMessage {
    #[serde(rename_all = "camelCase")]
    Join {
        channel_id: String,
        user_id: String,
        username: String,
    },
    #[serde(rename_all = "camelCase")]
    Leave {
        channel_id: String,
        user_id: String,
    },
    #[serde(rename_all = "camelCase")]
    Offer {
        channel_id: String,
        from: String,
        to: String,
        sdp: serde_json::Value,
    },
    #[serde(rename_all = "camelCase")]
    Answer {
        channel_id: String,
        from: String,
        to: String,
        sdp: serde_json::Value,
    },
    #[serde(rename_all = "camelCase")]
    Ice {
        channel_id: String,
        from: String,
        to: String,
        candidate: serde_json::Value,
    },
    #[serde(rename_all = "camelCase")]
    MediaState {
        channel_id: String,
        user_id: String,
        is_muted: bool,
        is_deafened: bool,
    },

    #[serde(rename_all = "camelCase")]
    Chat {
        channel_id: String,
        from: String,
        username: String,
        message: String,
        timestamp: u64, // Correction : u64 au lieu de String
    },
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
enum ServerMessage {
    #[serde(rename_all = "camelCase")]
    Joined {
        channel_id: String,
        peers: Vec<PeerInfo>,
    },
    #[serde(rename_all = "camelCase")]
    PeerJoined {
        channel_id: String,
        peer: PeerInfo,
    },
    #[serde(rename_all = "camelCase")]
    PeerLeft {
        channel_id: String,
        user_id: String,
    },
    #[serde(rename_all = "camelCase")]
    Offer {
        channel_id: String,
        from: String,
        from_username: String,
        sdp: serde_json::Value,
    },
    #[serde(rename_all = "camelCase")]
    Answer {
        channel_id: String,
        from: String,
        from_username: String,
        sdp: serde_json::Value,
    },
    #[serde(rename_all = "camelCase")]
    Ice {
        channel_id: String,
        from: String,
        from_username: String,
        candidate: serde_json::Value,
    },
    #[serde(rename_all = "camelCase")]
    PeerState {
        channel_id: String,
        user_id: String,
        is_muted: bool,
        is_deafened: bool,
    },
    #[serde(rename_all = "camelCase")]
    Chat {
        channel_id: String,
        from: String,
        username: String,
        message: String,
        timestamp: u64, // Correction : u64 au lieu de String
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PeerInfo {
    user_id: String,
    username: String,
    is_muted: bool,
    is_deafened: bool,
}

fn serialize_message(message: &ServerMessage) -> Option<String> {
    serde_json::to_string(message).ok()
}

async fn send_to_user(state: &Arc<AppState>, user_id: &str, message: &ServerMessage) {
    let payload = match serialize_message(message) {
        Some(payload) => payload,
        None => return,
    };

    let peers = state.peers.lock().await;
    if let Some(peer) = peers.get(user_id) {
        let _ = peer.tx.send(payload);
    }
}

async fn broadcast_to_channel(state: &Arc<AppState>, channel_id: &str, message: &ServerMessage, exclude: Option<&str>) {
    let payload = match serialize_message(message) {
        Some(payload) => payload,
        None => return,
    };

    let members = {
        let channels = state.channels.lock().await;
        channels.get(channel_id).cloned().unwrap_or_default()
    };

    let peers = state.peers.lock().await;
    for member in members {
        if exclude == Some(member.as_str()) {
            continue;
        }
        if let Some(peer) = peers.get(&member) {
            let _ = peer.tx.send(payload.clone());
        }
    }
}

async fn remove_peer(state: &Arc<AppState>, user_id: &str) {
    let removed = {
        let mut peers = state.peers.lock().await;
        peers.remove(user_id)
    };

    if let Some(peer) = removed {
        let channel_id = peer.channel_id.clone();

        let should_remove_channel = {
            let mut channels = state.channels.lock().await;
            if let Some(members) = channels.get_mut(&channel_id) {
                members.retain(|id| id != user_id);
                members.is_empty()
            } else {
                false
            }
        };

        if should_remove_channel {
            let mut channels = state.channels.lock().await;
            channels.remove(&channel_id);
        }

        broadcast_to_channel(
            state,
            &channel_id,
            &ServerMessage::PeerLeft {
                channel_id: channel_id.clone(),
                user_id: peer.user_id,
            },
            None,
        )
        .await;
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let app_state = Arc::new(AppState {
        peers: Mutex::new(HashMap::new()),
        channels: Mutex::new(HashMap::new()),
    });

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .route("/health", get(|| async { "ok" }))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "3001".to_string());
    let addr = format!("0.0.0.0:{}", port);
    let listner = tokio::net::TcpListener::bind(&addr).await.unwrap();
    println!("Signaling server on port {}", port);
    axum::serve(listner, app).await.unwrap();
}

async fn ws_handler(ws: WebSocketUpgrade, axum::extract::State(state): axum::extract::State<Arc<AppState>>) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut socket_sender, mut socket_receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();
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
            Message::Text(text) => text,
            Message::Close(_) => break,
            _ => continue,
        };

        let parsed = serde_json::from_str::<ClientMessage>(&text);
        let msg = match parsed {
            Ok(msg) => msg,
            Err(_) => {
                let _ = tx.send(
                    serialize_message(&ServerMessage::Error {
                        message: "Message invalide".to_string(),
                    })
                    .unwrap_or_else(|| "{\"type\":\"error\",\"message\":\"Serialization failed\"}".to_string()),
                );
                continue;
            }
        };

        match msg {
            ClientMessage::Join {
                channel_id,
                user_id,
                username,
            } => {
                remove_peer(&state, &user_id).await;

                let existing_peers = {
                    let channels = state.channels.lock().await;
                    let members = channels.get(&channel_id).cloned().unwrap_or_default();

                    let peers = state.peers.lock().await;
                    members
                        .iter()
                        .filter_map(|member_id| {
                            peers.get(member_id).map(|peer| PeerInfo {
                                user_id: peer.user_id.clone(),
                                username: peer.username.clone(),
                                is_muted: peer.is_muted,
                                is_deafened: peer.is_deafened,
                            })
                        })
                        .collect::<Vec<_>>()
                };

                {
                    let mut peers = state.peers.lock().await;
                    peers.insert(
                        user_id.clone(),
                        PeerSession {
                            user_id: user_id.clone(),
                            username: username.clone(),
                            channel_id: channel_id.clone(),
                            tx: tx.clone(),
                            is_muted: false,
                            is_deafened: false,
                        },
                    );
                }

                {
                    let mut channels = state.channels.lock().await;
                    let members = channels.entry(channel_id.clone()).or_default();
                    if !members.iter().any(|id| id == &user_id) {
                        members.push(user_id.clone());
                    }
                }

                let joined = ServerMessage::Joined {
                    channel_id: channel_id.clone(),
                    peers: existing_peers,
                };
                if let Some(payload) = serialize_message(&joined) {
                    let _ = tx.send(payload);
                }

                broadcast_to_channel(
                    &state,
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

                current_user_id = Some(user_id);
            }
            ClientMessage::Leave { channel_id, user_id } => {
                let can_leave = {
                    let peers = state.peers.lock().await;
                    peers
                        .get(&user_id)
                        .map(|peer| peer.channel_id == channel_id)
                        .unwrap_or(false)
                };

                if can_leave {
                    remove_peer(&state, &user_id).await;
                }

                if current_user_id.as_deref() == Some(user_id.as_str()) {
                    current_user_id = None;
                }
            }
            ClientMessage::Offer {
                channel_id,
                from,
                to,
                sdp,
            } => {
                let from_username = {
                    let peers = state.peers.lock().await;
                    peers
                        .get(&from)
                        .map(|peer| peer.username.clone())
                        .unwrap_or_else(|| "Unknown".to_string())
                };

                send_to_user(
                    &state,
                    &to,
                    &ServerMessage::Offer {
                        channel_id,
                        from,
                        from_username,
                        sdp,
                    },
                )
                .await;
            }
            ClientMessage::Answer {
                channel_id,
                from,
                to,
                sdp,
            } => {
                let from_username = {
                    let peers = state.peers.lock().await;
                    peers
                        .get(&from)
                        .map(|peer| peer.username.clone())
                        .unwrap_or_else(|| "Unknown".to_string())
                };

                send_to_user(
                    &state,
                    &to,
                    &ServerMessage::Answer {
                        channel_id,
                        from,
                        from_username,
                        sdp,
                    },
                )
                .await;
            }
            ClientMessage::Ice {
                channel_id,
                from,
                to,
                candidate,
            } => {
                let from_username = {
                    let peers = state.peers.lock().await;
                    peers
                        .get(&from)
                        .map(|peer| peer.username.clone())
                        .unwrap_or_else(|| "Unknown".to_string())
                };

                send_to_user(
                    &state,
                    &to,
                    &ServerMessage::Ice {
                        channel_id,
                        from,
                        from_username,
                        candidate,
                    },
                )
                .await;
            }
            ClientMessage::MediaState {
                channel_id,
                user_id,
                is_muted,
                is_deafened,
            } => {
                // MAJ de l'état mute/deaf côté serveur
                {
                    let mut peers = state.peers.lock().await;
                    if let Some(peer) = peers.get_mut(&user_id) {
                        peer.is_muted = is_muted;
                        peer.is_deafened = is_deafened;
                    }
                }
                broadcast_to_channel(
                    &state,
                    &channel_id,
                    &ServerMessage::PeerState {
                        channel_id: channel_id.clone(),
                        user_id: user_id.clone(),
                        is_muted,
                        is_deafened,
                    },
                    Some(&user_id),
                )
                .await;
            }
            // Ajout gestion du chat
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
        }
    }

    if let Some(user_id) = current_user_id {
        remove_peer(&state, &user_id).await;
    }

    send_task.abort();
}
