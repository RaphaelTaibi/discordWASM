use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
    Router,
};
use axum_server::tls_rustls::RustlsConfig;
use std::path::PathBuf;
use std::net::SocketAddr;

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::{mpsc, Mutex};
use tower_http::cors::CorsLayer;

// WebRTC Imports: Essential for Selective Forwarding Unit (SFU) logic
use webrtc::api::interceptor_registry::register_default_interceptors;
use webrtc::api::media_engine::MediaEngine;
use webrtc::api::setting_engine::SettingEngine;
use webrtc::api::APIBuilder;
use webrtc::api::API;
use webrtc::interceptor::registry::Registry as InterceptorRegistry;
use webrtc::peer_connection::configuration::RTCConfiguration;
use webrtc::peer_connection::RTCPeerConnection;
use webrtc::peer_connection::sdp::session_description::RTCSessionDescription;
use webrtc::ice_transport::ice_server::RTCIceServer;
use webrtc::ice_transport::ice_candidate::RTCIceCandidateInit;
use webrtc::track::track_local::track_local_static_rtp::TrackLocalStaticRTP;
use webrtc::track::track_local::TrackLocalWriter;
use webrtc::ice::udp_network::{EphemeralUDP, UDPNetwork};
use webrtc::rtp::packet::Packet;

/// Channel state to track members and activation time
pub struct ChannelState {
    pub members: Vec<String>,
    pub started_at: u64,
}

/// Global Application State: Shared across all WebSocket connections
struct AppState {
    peers: Mutex<HashMap<String, PeerSession>>,
    channels: Mutex<HashMap<String, ChannelState>>,
    shared_tracks: Mutex<HashMap<String, HashMap<String, Arc<TrackLocalStaticRTP>>>>,
    api: API,
    batch_tx: mpsc::UnboundedSender<RtpBatchItem>,
}

/// Individual item for the global RTP batching queue
struct RtpBatchItem {
    track: Arc<TrackLocalStaticRTP>,
    packet: Packet,
}

/// Represents a single user's connection and state
#[derive(Clone)]
struct PeerSession {
    user_id: String,
    username: String,
    channel_id: String,
    tx: mpsc::UnboundedSender<String>,
    is_muted: bool,
    is_deafened: bool,
    peer_connection: Option<Arc<RTCPeerConnection>>,
}

/// Incoming messages from the Client (Frontend)
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
enum ClientMessage {
    #[serde(rename_all = "camelCase")]
    Join { channel_id: String, user_id: String, username: String },
    #[serde(rename_all = "camelCase")]
    Leave { channel_id: String, user_id: String },
    #[serde(rename_all = "camelCase")]
    Offer { sdp: serde_json::Value },
    #[serde(rename_all = "camelCase")]
    Answer { sdp: serde_json::Value },
    #[serde(rename_all = "camelCase")]
    Ice { candidate: serde_json::Value },
    #[serde(rename_all = "camelCase")]
    MediaState { channel_id: String, user_id: String, is_muted: bool, is_deafened: bool },
    #[serde(rename_all = "camelCase")]
    Chat { channel_id: String, from: String, username: String, message: String, timestamp: u64 },
}

/// Outgoing messages sent to the Client (Frontend)
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
enum ServerMessage {
    #[serde(rename_all = "camelCase")]
    Joined { channel_id: String, peers: Vec<PeerInfo>, started_at: u64 },
    #[serde(rename_all = "camelCase")]
    PeerJoined { channel_id: String, peer: PeerInfo },
    #[serde(rename_all = "camelCase")]
    PeerLeft { channel_id: String, user_id: String },
    #[serde(rename_all = "camelCase")]
    Answer { sdp: serde_json::Value },
    #[serde(rename_all = "camelCase")]
    Offer { sdp: serde_json::Value },
    #[serde(rename_all = "camelCase")]
    Ice { candidate: serde_json::Value },
    #[serde(rename_all = "camelCase")]
    PeerState { channel_id: String, user_id: String, is_muted: bool, is_deafened: bool },
    #[serde(rename_all = "camelCase")]
    TrackMap { user_id: String, track_id: String, stream_id: String, kind: String },
    #[serde(rename_all = "camelCase")]
    Chat { channel_id: String, from: String, username: String, message: String, timestamp: u64 },
    Error { message: String },
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

/// Broadcasts a JSON payload to all active members of a specific channel
async fn broadcast_to_channel(state: &Arc<AppState>, channel_id: &str, message: &ServerMessage, exclude: Option<&str>) {
    let payload = match serialize_message(message) {
        Some(payload) => payload,
        None => return,
    };

    // Scoped lock to prevent holding the Mutex during network I/O
    let members = {
        let channels = state.channels.lock().await;
        channels.get(channel_id).map(|c| c.members.clone()).unwrap_or_default()
    };

    let peers = state.peers.lock().await;
    for member in members {
        if exclude == Some(member.as_str()) { continue; }
        if let Some(peer) = peers.get(&member) {
            let _ = peer.tx.send(payload.clone());
        }
    }
}

/// Handles peer cleanup, closing WebRTC connections, and updating global channel maps
async fn remove_peer(state: &Arc<AppState>, user_id: &str) {
    let removed = {
        let mut peers = state.peers.lock().await;
        peers.remove(user_id)
    };

    if let Some(peer) = removed {
        // Explicitly close the WebRTC PeerConnection to release UDP ports
        if let Some(pc) = peer.peer_connection {
            let _ = pc.close().await;
        }

        let channel_id = peer.channel_id.clone();
        let mut channels = state.channels.lock().await;

        if let Some(channel) = channels.get_mut(&channel_id) {
            channel.members.retain(|id| id != user_id);
            // Delete the channel entry if no members remain
            if channel.members.is_empty() {
                channels.remove(&channel_id);
                // Also clean up tracks associated with this channel
                let mut tracks = state.shared_tracks.lock().await;
                tracks.remove(&channel_id);
            }
        }

        broadcast_to_channel(state, &channel_id, &ServerMessage::PeerLeft {
            channel_id: channel_id.clone(),
            user_id: user_id.to_string()
        }, None).await;
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    // Initialize WebRTC MediaEngine with default codecs (VP8/VP9/H264/Opus)
    let mut m = MediaEngine::default();
    m.register_default_codecs().expect("Failed to register codecs");

    // Enforce UDP port constraints for Oracle Cloud / Firewall compatibility
    let mut setting_engine = SettingEngine::default();
    let ephemeral_udp = EphemeralUDP::new(10000, 10100).expect("Failed to set port range");
    setting_engine.set_udp_network(UDPNetwork::Ephemeral(ephemeral_udp));

    let mut registry = InterceptorRegistry::default();
    registry = register_default_interceptors(registry, &mut m).expect("Failed to register interceptors");

    let (batch_tx, mut batch_rx) = mpsc::unbounded_channel::<RtpBatchItem>();

    /// Global RTP Batcher Task
    /// Prevents OS scheduler overhead by grouping small UDP packets into larger bursts
    /// and ensures a steady egress cadence to smooth out network jitter.
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_millis(20));
        let mut buffer: Vec<RtpBatchItem> = Vec::with_capacity(1024);

        loop {
            tokio::select! {
                Some(item) = batch_rx.recv() => {
                    buffer.push(item);
                    // Threshold-based flush: group up to 64 packets for bulk processing
                    if buffer.len() >= 64 {
                        let current_batch = buffer.drain(..).collect::<Vec<_>>();
                        tokio::spawn(async move {
                            for item in current_batch {
                                let _ = item.track.write_rtp(&item.packet).await;
                            }
                        });
                    }
                }
                _ = interval.tick() => {
                    // Time-based flush: ensures real-time delivery even if buffer isn't full
                    if !buffer.is_empty() {
                        let current_batch = buffer.drain(..).collect::<Vec<_>>();
                        tokio::spawn(async move {
                            for item in current_batch {
                                let _ = item.track.write_rtp(&item.packet).await;
                            }
                        });
                    }
                }
            }
        }
    });

    let api = APIBuilder::new()
        .with_media_engine(m)
        .with_interceptor_registry(registry)
        .with_setting_engine(setting_engine)
        .build();

    let app_state = Arc::new(AppState {
        peers: Mutex::new(HashMap::new()),
        channels: Mutex::new(HashMap::new()),
        shared_tracks: Mutex::new(HashMap::new()),
        api,
        batch_tx,
    });

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .route("/health", get(|| async { "Healthy" }))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    // TLS Infrastructure for Secure WebSocket (WSS) and HTTPS
    let config = RustlsConfig::from_pem_file(PathBuf::from("cert.pem"), PathBuf::from("key.pem"))
        .await
        .expect("Failed to find cert.pem or key.pem");

    let addr: SocketAddr = "0.0.0.0:3001".parse().unwrap();
    println!("SFU Server running on https://{} | UDP Range: 10000-10100", addr);
    axum_server::bind_rustls(addr, config).serve(app.into_make_service()).await.unwrap();
}

async fn ws_handler(ws: WebSocketUpgrade, axum::extract::State(state): axum::extract::State<Arc<AppState>>) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

/// Manages a specific peer's WebSocket lifecycle and signaling state machine
async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut socket_sender, mut socket_receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();
    let mut current_user_id: Option<String> = None;

    // Background task to pump messages from internal MPSC to the WebSocket stream
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if socket_sender.send(Message::Text(msg)).await.is_err() { break; }
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
            ClientMessage::Join { channel_id, user_id, username } => {
                if let Some(old_id) = current_user_id.take() {
                    remove_peer(&state, &old_id).await;
                }

                // Atomic channel join logic
                let (existing_peers, started_at) = {
                    let mut channels = state.channels.lock().await;
                    let channel = channels.entry(channel_id.clone()).or_insert_with(|| ChannelState {
                        members: Vec::new(),
                        started_at: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64,
                    });

                    let peers = state.peers.lock().await;
                    let existing = channel.members.iter().filter_map(|m_id| peers.get(m_id).map(|p| PeerInfo {
                        user_id: p.user_id.clone(),
                        username: p.username.clone(),
                        is_muted: p.is_muted,
                        is_deafened: p.is_deafened,
                    })).collect::<Vec<PeerInfo>>();

                    (existing, channel.started_at)
                };

                state.peers.lock().await.insert(user_id.clone(), PeerSession {
                    user_id: user_id.clone(),
                    username: username.clone(),
                    channel_id: channel_id.clone(),
                    tx: tx.clone(),
                    is_muted: false,
                    is_deafened: false,
                    peer_connection: None,
                });

                {
                    let mut channels = state.channels.lock().await;
                    if let Some(channel) = channels.get_mut(&channel_id) {
                        if !channel.members.contains(&user_id) {
                            channel.members.push(user_id.clone());
                        }
                    }
                }

                let _ = tx.send(serialize_message(&ServerMessage::Joined { channel_id: channel_id.clone(), peers: existing_peers, started_at }).unwrap());
                broadcast_to_channel(&state, &channel_id.clone(), &ServerMessage::PeerJoined {
                    channel_id, peer: PeerInfo { user_id: user_id.clone(), username, is_muted: false, is_deafened: false }
                }, Some(&user_id)).await;
                current_user_id = Some(user_id);
            }

            ClientMessage::Offer { sdp } => {
                let uid = current_user_id.clone().unwrap_or_default();
                let sdp_str = sdp["sdp"].as_str().unwrap_or_default().to_string();

                let channel_id = {
                    let peers = state.peers.lock().await;
                    peers.get(&uid).map(|p| p.channel_id.clone()).unwrap_or_default()
                };

                let config = RTCConfiguration {
                    ice_servers: vec![RTCIceServer { urls: vec!["stun:stun.l.google.com:19302".to_string()], ..Default::default() }],
                    ..Default::default()
                };

                let pc = Arc::new(state.api.new_peer_connection(config).await.expect("Failed to create PC"));

                // Signaling: Relay local ICE candidates to the client
                let tx_ice = tx.clone();
                pc.on_ice_candidate(Box::new(move |c| {
                    let tx_c = tx_ice.clone();
                    Box::pin(async move {
                        if let Some(candidate) = c {
                            let json = candidate.to_json().unwrap();
                            let _ = tx_c.send(serialize_message(&ServerMessage::Ice { candidate: serde_json::to_value(json).unwrap() }).unwrap());
                        }
                    })
                }));

                // Forwarding Logic: Detects incoming tracks and publishes them to the channel
                let uid_t = uid.clone();
                let channel_id_t = channel_id.clone();
                let state_t = Arc::clone(&state);
                pc.on_track(Box::new(move |track, _, _| {
                    let u_id = uid_t.clone();
                    let c_id = channel_id_t.clone();
                    let st = Arc::clone(&state_t);

                    Box::pin(async move {
                        let track_id = track.id().to_string();
                        let stream_id = track.stream_id().to_string();
                        let kind = track.kind().to_string();

                        // Instantiate a local track to bridge traffic between peers
                        let local_track = Arc::new(TrackLocalStaticRTP::new(
                            track.codec().capability.clone(),
                            track_id.clone(),
                            stream_id.clone(),
                        ));

                        // Store track in the global SFU registry
                        {
                            let mut shared = st.shared_tracks.lock().await;
                            let channel_tracks = shared.entry(c_id.clone()).or_default();
                            channel_tracks.insert(u_id.clone(), Arc::clone(&local_track));
                        }

                        broadcast_to_channel(&st, &c_id, &ServerMessage::TrackMap {
                            user_id: u_id.clone(), track_id, stream_id, kind,
                        }, None).await;

                        // Selective Forwarding: Attach this new track to all other peers in the channel
                        let members = {
                            let channels = st.channels.lock().await;
                            channels.get(&c_id).map(|c| c.members.clone()).unwrap_or_default()
                        };

                        let mut peers = st.peers.lock().await;
                        for member in members {
                            if member != u_id {
                                if let Some(peer) = peers.get_mut(&member) {
                                    if let Some(other_pc) = &peer.peer_connection {
                                        // Negotiation: Update other peers' PeerConnections with the new stream
                                        if other_pc.add_track(Arc::clone(&local_track) as Arc<dyn webrtc::track::track_local::TrackLocal + Send + Sync>).await.is_ok() {
                                            let other_tx = peer.tx.clone();
                                            let other_pc_clone = Arc::clone(other_pc);
                                            tokio::spawn(async move {
                                                if let Ok(offer) = other_pc_clone.create_offer(None).await {
                                                    if other_pc_clone.set_local_description(offer.clone()).await.is_ok() {
                                                        let _ = other_tx.send(serialize_message(&ServerMessage::Offer {
                                                            sdp: serde_json::json!({"type": "offer", "sdp": offer.sdp}),
                                                        }).unwrap());
                                                    }
                                                }
                                            });
                                        }
                                    }
                                }
                            }
                        }

                        // Egress: Continuously read RTP packets and push to the global batcher queue
                        while let Ok((rtp, _)) = track.read_rtp().await {
                            let _ = st.batch_tx.send(RtpBatchItem {
                                track: Arc::clone(&local_track),
                                packet: rtp,
                            });
                        }
                    })
                }));

                // Catch-up: Add existing tracks from current members to this new joining peer
                {
                    let shared = state.shared_tracks.lock().await;
                    if let Some(channel_tracks) = shared.get(&channel_id) {
                        for (_, t) in channel_tracks {
                            let _ = pc.add_track(Arc::clone(t) as Arc<dyn webrtc::track::track_local::TrackLocal + Send + Sync>).await;
                        }
                    }
                }

                // Finalize WebRTC Handshake (SDP Exchange)
                pc.set_remote_description(RTCSessionDescription::offer(sdp_str).unwrap()).await.unwrap();
                let answer = pc.create_answer(None).await.unwrap();
                pc.set_local_description(answer.clone()).await.unwrap();

                if let Some(peer) = state.peers.lock().await.get_mut(&uid) {
                    peer.peer_connection = Some(Arc::clone(&pc));
                }

                let _ = tx.send(serialize_message(&ServerMessage::Answer {
                    sdp: serde_json::json!({"type": "answer", "sdp": answer.sdp}),
                }).unwrap());
            }

            ClientMessage::Answer { sdp } => {
                let uid = current_user_id.clone().unwrap_or_default();
                let sdp_str = sdp["sdp"].as_str().unwrap_or_default().to_string();
                if let Some(peer) = state.peers.lock().await.get(&uid) {
                    if let Some(pc) = &peer.peer_connection {
                        let _ = pc.set_remote_description(RTCSessionDescription::answer(sdp_str).unwrap()).await;
                    }
                }
            }

            ClientMessage::Ice { candidate } => {
                let uid = current_user_id.clone().unwrap_or_default();
                if let Some(peer) = state.peers.lock().await.get(&uid) {
                    if let Some(pc) = &peer.peer_connection {
                        if let Ok(c_init) = serde_json::from_value::<RTCIceCandidateInit>(candidate) {
                            let _ = pc.add_ice_candidate(c_init).await;
                        }
                    }
                }
            }

            ClientMessage::MediaState { channel_id, user_id, is_muted, is_deafened } => {
                let uid_for_exclude = user_id.clone();
                if let Some(peer) = state.peers.lock().await.get_mut(&user_id) {
                    peer.is_muted = is_muted;
                    peer.is_deafened = is_deafened;
                }
                broadcast_to_channel(&state, &channel_id.clone(), &ServerMessage::PeerState {
                    channel_id, user_id, is_muted, is_deafened
                }, Some(uid_for_exclude.as_str())).await;
            }

            ClientMessage::Chat { channel_id, from, username, message, timestamp } => {
                broadcast_to_channel(&state, &channel_id.clone(), &ServerMessage::Chat {
                    channel_id, from, username, message, timestamp
                }, None).await;
            }

            ClientMessage::Leave { .. } => {
                if let Some(uid) = current_user_id.clone() {
                    remove_peer(&state, &uid).await;
                    current_user_id = None;
                }
            }
        }
    }

    // Cleanup session upon WebSocket disconnection
    if let Some(user_id) = current_user_id {
        remove_peer(&state, &user_id).await;
    }
    send_task.abort();
}