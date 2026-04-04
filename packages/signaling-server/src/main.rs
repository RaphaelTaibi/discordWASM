use axum::{
    Router,
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
};
use axum_server::tls_rustls::RustlsConfig;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::{HashSet, VecDeque};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::time::{Duration, Instant};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::{Mutex, mpsc};
use tower_http::cors::CorsLayer;
use webrtc::api::API;
use webrtc::api::APIBuilder;
use webrtc::api::interceptor_registry::register_default_interceptors;
use webrtc::api::media_engine::MediaEngine;
use webrtc::api::setting_engine::SettingEngine;
use webrtc::ice::udp_network::{EphemeralUDP, UDPNetwork};
use webrtc::ice_transport::ice_candidate::RTCIceCandidateInit;
use webrtc::ice_transport::ice_server::RTCIceServer;
use webrtc::interceptor::registry::Registry as InterceptorRegistry;
use webrtc::peer_connection::RTCPeerConnection;
use webrtc::peer_connection::configuration::RTCConfiguration;
use webrtc::peer_connection::sdp::session_description::RTCSessionDescription;
use webrtc::rtp::packet::Packet;
use webrtc::rtp_transceiver::rtp_codec::RTCRtpCodecCapability;
use webrtc::track::track_local::TrackLocalWriter;
use webrtc::track::track_local::track_local_static_rtp::TrackLocalStaticRTP;
use prometheus::{
    Encoder,
    Histogram,
    IntGauge,
    TextEncoder,
    register_histogram,
    register_int_gauge,
};
use once_cell::sync::Lazy;
use rustls::crypto::aws_lc_rs;


///Global Metrics
static ACTIVE_PEERS: Lazy<IntGauge> = Lazy::new(|| {
    register_int_gauge!(
        "sfu_active_peers",
        "Nombre de pairs connectés"
    ).unwrap()
});

static ACTIVE_CHANNELS: Lazy<IntGauge> = Lazy::new(|| {
    register_int_gauge!(
        "sfu_active_channels",
        "Nombre de salons actifs"
    ).unwrap()
});

static BANDWIDTH_EGRESS: Lazy<IntGauge> = Lazy::new(|| {
    register_int_gauge!(
        "sfu_bandwidth_egress_bps",
        "Bande passante sortante (bits/s)"
    ).unwrap()
});

static BANDWIDTH_INGRESS: Lazy<IntGauge> = Lazy::new(|| {
    register_int_gauge!(
        "sfu_bandwidth_ingress_bps",
        "Bande passante entrante (bits/s)"
    ).unwrap()
});

static PACKETS_PER_SEC: Lazy<Histogram> = Lazy::new(|| {
    register_histogram!(
        "sfu_packets_per_second",
        "Paquets RTP par seconde",
        vec![100.0, 500.0, 1000.0, 5000.0, 10000.0]
    ).unwrap()
});

/// Forwarder state with associated task handle
#[derive(Clone)]
pub struct ForwarderState {
    pub source_user_id: String,
    pub track_id: String,
    pub stream_id: String,
    pub kind: String,
    pub codec: RTCRtpCodecCapability,
    pub destination_tracks: HashMap<String, Arc<TrackLocalStaticRTP>>,
    pub tx: mpsc::UnboundedSender<Packet>,
}

/// Jitter Buffer for smoothing packet delivery
pub struct JitterBuffer {
    packets: VecDeque<Packet>,
    playout_delay_ms: u32,
    clock_rate: u32,
    last_timestamp: u32,
}

impl JitterBuffer {
    pub fn new(playout_delay_ms: u32, clock_rate: u32) -> Self {
        Self {
            packets: VecDeque::with_capacity(100),
            playout_delay_ms,
            clock_rate,
            last_timestamp: 0,
        }
    }

    pub fn push(&mut self, packet: Packet) {
        // FIX: Extract timestamp BEFORE push_back to avoid borrow conflict
        let timestamp = packet.header.timestamp;
        self.packets.push_back(packet);
        self.last_timestamp = timestamp;

        let playout = self.playout_delay_ms;
        let clock = self.clock_rate;
        let last_t = self.last_timestamp;

        self.packets.retain(|p| {
            let diff = last_t.wrapping_sub(p.header.timestamp);
            let age_ms = diff * 1000 / clock;
            age_ms <= playout
        });
    }

    pub fn pop(&mut self) -> Option<Packet> {
        if let Some(front) = self.packets.front() {
            let age_ms = self.calculate_age_ms(front.header.timestamp);
            if age_ms >= self.playout_delay_ms {
                return self.packets.pop_front();
            }
        }
        None
    }

    fn calculate_age_ms(&self, timestamp: u32) -> u32 {
        if self.last_timestamp == 0 {
            return 0;
        }
        let diff = self.last_timestamp.wrapping_sub(timestamp);
        diff * 1000 / self.clock_rate
    }
}

/// RTCP Statistics for monitoring
#[derive(Debug, Clone)]
pub struct RTCPStats {
    pub packets_sent: u64,
    pub bytes_sent: u64,
    pub last_update: Instant,
}

impl RTCPStats {
    pub fn new() -> Self {
        Self {
            packets_sent: 0,
            bytes_sent: 0,
            last_update: Instant::now(),
        }
    }

    pub fn update(&mut self, packets: u64, bytes: u64) {
        self.packets_sent += packets;
        self.bytes_sent += bytes;
        self.last_update = Instant::now();
    }

    pub fn bandwidth_bps(&self) -> u64 {
        let elapsed = self.last_update.elapsed().as_secs_f64();
        if elapsed > 0.0 {
            ((self.bytes_sent as f64 / elapsed) * 8.0) as u64
        } else {
            0
        }
    }
}

/// Channel state to track members and activation time
pub struct ChannelState {
    pub members: HashSet<String>,
    pub started_at: u64,
    pub forwarders: HashMap<String, ForwarderState>,
    pub stats: HashMap<String, RTCPStats>,
}

/// Global Application State
struct AppState {
    peers: Mutex<HashMap<String, PeerSession>>,
    channels: Mutex<HashMap<String, ChannelState>>,
    api: API,
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

/// Incoming messages from the Client
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
    Leave { channel_id: String, user_id: String },
    #[serde(rename_all = "camelCase")]
    Offer { sdp: serde_json::Value },
    #[serde(rename_all = "camelCase")]
    Answer { sdp: serde_json::Value },
    #[serde(rename_all = "camelCase")]
    Ice { candidate: serde_json::Value },
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
        timestamp: u64,
    },
}

/// Outgoing messages sent to the Client
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
enum ServerMessage {
    #[serde(rename_all = "camelCase")]
    Joined {
        channel_id: String,
        peers: Vec<PeerInfo>,
        started_at: u64,
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
    Answer {
        sdp: serde_json::Value,
    },
    #[serde(rename_all = "camelCase")]
    Offer {
        sdp: serde_json::Value,
    },
    #[serde(rename_all = "camelCase")]
    Ice {
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
    TrackMap {
        user_id: String,
        track_id: String,
        stream_id: String,
        kind: String,
    },
    #[serde(rename_all = "camelCase")]
    Chat {
        channel_id: String,
        from: String,
        username: String,
        message: String,
        timestamp: u64,
    },
    #[serde(rename_all = "camelCase")]
    Stats {
        user_id: String,
        bandwidth_bps: u64,
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

/// Broadcasts a JSON payload to all active members of a specific channel
async fn broadcast_to_channel(
    state: &Arc<AppState>,
    channel_id: &str,
    message: &ServerMessage,
    exclude: Option<&str>,
) {
    let payload = match serialize_message(message) {
        Some(payload) => payload,
        None => return,
    };
    let members = {
        let channels = state.channels.lock().await;
        channels
            .get(channel_id)
            .map(|c| c.members.clone())
            .unwrap_or_default()
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

/// Handles peer cleanup
async fn remove_peer(state: &Arc<AppState>, user_id: &str) {
    let channel_id = {
        let peers = state.peers.lock().await;
        peers
            .get(user_id)
            .map(|p| p.channel_id.clone())
            .unwrap_or_default()
    };

    let removed = {
        let mut peers = state.peers.lock().await;
        peers.remove(user_id)
    };

    if let Some(peer) = removed {
        if let Some(pc) = peer.peer_connection {
            let _ = pc.close().await;
        }

        // Clean up forwarders where this user is the source
        {
            let mut channels = state.channels.lock().await;
            if let Some(channel) = channels.get_mut(&channel_id) {
                channel
                    .forwarders
                    .retain(|_, f| f.source_user_id != user_id);
            }
        }

        // Remove from all destination tracks
        {
            let mut channels = state.channels.lock().await;
            if let Some(channel) = channels.get_mut(&channel_id) {
                for forwarder in channel.forwarders.values_mut() {
                    forwarder.destination_tracks.remove(user_id);
                }
                channel.stats.remove(user_id);
            }
        }

        // Remove from channel members
        {
            let mut channels = state.channels.lock().await;
            if let Some(channel) = channels.get_mut(&channel_id) {
                channel.members.remove(user_id);
                if channel.members.is_empty() {
                    channels.remove(&channel_id);
                }
            }
        }

        broadcast_to_channel(
            state,
            &channel_id,
            &ServerMessage::PeerLeft {
                channel_id: channel_id.clone(),
                user_id: user_id.to_string(),
            },
            None,
        )
        .await;
    }
}

#[tokio::main]
async fn main() {

    if let Err(e) = aws_lc_rs::default_provider().install_default() {
        eprintln!("Failed to install aws-lc-rs crypto provider: {:?}", e);
        std::process::exit(1);
    }

    tracing_subscriber::fmt::init();


    let mut m = MediaEngine::default();
    m.register_default_codecs()
        .expect("Failed to register codecs");
    let mut setting_engine = SettingEngine::default();
    let ephemeral_udp = EphemeralUDP::new(10000, 20000).expect("Failed to set port range");
    setting_engine.set_udp_network(UDPNetwork::Ephemeral(ephemeral_udp));
    let mut registry = InterceptorRegistry::default();
    registry =
        register_default_interceptors(registry, &mut m).expect("Failed to register interceptors");
    let api = APIBuilder::new()
        .with_media_engine(m)
        .with_interceptor_registry(registry)
        .with_setting_engine(setting_engine)
        .build();
    let app_state = Arc::new(AppState {
        peers: Mutex::new(HashMap::new()),
        channels: Mutex::new(HashMap::new()),
        api,
    });
    let stats_state = Arc::clone(&app_state);
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(2));
        loop {
            interval.tick().await;
            let all_stats = {
                let channels = stats_state.channels.lock().await;
                let mut total_packets = 0u64;
                let mut stats_list = Vec::new();
                for (channel_id, channel) in channels.iter() {
                    for (user_id, stats) in channel.stats.iter() {
                        let peers = stats_state.peers.lock().await;
                        if peers.contains_key(user_id) {
                            total_packets += stats.packets_sent;
                            stats_list.push((
                                channel_id.clone(),
                                user_id.clone(),
                                ServerMessage::Stats {
                                    user_id: user_id.clone(),
                                    bandwidth_bps: stats.bandwidth_bps(),
                                }
                            ));
                        }
                    }
                }

                PACKETS_PER_SEC.observe(total_packets as f64);
                stats_list
            };
            for (_channel_id, user_id, msg) in all_stats {
                let peers = stats_state.peers.lock().await;
                if let Some(peer) = peers.get(&user_id) {
                    let _ = peer.tx.send(serialize_message(&msg).unwrap());
                }
            }
        }
    });
    let app: Router<()> = Router::new()
        .route("/ws", get(ws_handler))
        .route("/health", get(|| async { "Healthy" }))
        .route("/metrics", get(prometheus_handler))
        .layer(CorsLayer::permissive())
        .with_state(app_state);
    let config = RustlsConfig::from_pem_file(PathBuf::from("cert.pem"), PathBuf::from("key.pem"))
        .await
        .expect("Failed to find cert.pem or key.pem");
    let addr: SocketAddr = "0.0.0.0:3001".parse().unwrap();
    println!(
        "SFU Server running on https://{} | UDP Range: 10000-20000",
        addr
    );

    axum_server::bind_rustls(addr, config)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

/// Handler Prometheus
async fn prometheus_handler(state: axum::extract::State<Arc<AppState>>) -> String {
    let peers = state.peers.lock().await;
    let channels = state.channels.lock().await;

    ACTIVE_PEERS.set(peers.len() as i64);
    ACTIVE_CHANNELS.set(channels.len() as i64);

    // Calculate total bandwidth
    let mut total_bandwidth: u64 = 0;
    for channel in channels.values() {
        for stats in channel.stats.values() {
            total_bandwidth += stats.bandwidth_bps();
        }
    }
    BANDWIDTH_EGRESS.set(total_bandwidth as i64);

    let mut total_ingress: u64 = 0;
    for channel in channels.values() {
        for stats in channel.stats.values() {
            total_ingress +=  stats.bandwidth_bps();
        }
    }
    BANDWIDTH_INGRESS.set(total_ingress as i64);

    // Encode metrics
    let encoder = TextEncoder::new();
    let mut buffer = Vec::new();
    encoder.encode(&prometheus::gather(), &mut buffer).unwrap();

    String::from_utf8(buffer).unwrap()
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

/// Manages a specific peer's WebSocket lifecycle
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
            } => {
                if let Some(old_id) = current_user_id.take() {
                    remove_peer(&state, &old_id).await;
                }

                let (existing_peers, started_at) = {
                    let mut channels = state.channels.lock().await;
                    let channel =
                        channels
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
                    let peers = state.peers.lock().await;
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

                state.peers.lock().await.insert(
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
                    let mut channels = state.channels.lock().await;
                    if let Some(channel) = channels.get_mut(&channel_id) {
                        channel.members.insert(user_id.clone());
                        channel.stats.insert(user_id.clone(), RTCPStats::new());
                    }
                }

                let _ = tx.send(
                    serialize_message(&ServerMessage::Joined {
                        channel_id: channel_id.clone(),
                        peers: existing_peers,
                        started_at,
                    })
                    .unwrap(),
                );
                broadcast_to_channel(
                    &state,
                    &channel_id.clone(),
                    &ServerMessage::PeerJoined {
                        channel_id,
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

            ClientMessage::Offer { sdp } => {
                let uid = current_user_id.clone().unwrap_or_default();
                let sdp_str = sdp["sdp"].as_str().unwrap_or_default().to_string();
                let channel_id = {
                    let peers = state.peers.lock().await;
                    peers
                        .get(&uid)
                        .map(|p| p.channel_id.clone())
                        .unwrap_or_default()
                };

                let config = RTCConfiguration {
                    ice_servers: vec![RTCIceServer {
                        urls: vec!["stun:stun.l.google.com:19302".to_string()],
                        ..Default::default()
                    }],
                    ..Default::default()
                };

                let pc = Arc::new(
                    state
                        .api
                        .new_peer_connection(config)
                        .await
                        .expect("Failed to create PC"),
                );

                let tx_ice = tx.clone();
                pc.on_ice_candidate(Box::new(move |c| {
                    let tx_c = tx_ice.clone();
                    Box::pin(async move {
                        if let Some(candidate) = c {
                            let json = candidate.to_json().unwrap();
                            let _ = tx_c.send(
                                serialize_message(&ServerMessage::Ice {
                                    candidate: serde_json::to_value(json).unwrap(),
                                })
                                .unwrap(),
                            );
                        }
                    })
                }));

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
                        let codec = track.codec().capability.clone();

                        // Create sender channel for this track
                        let (tx_track, rx_track) = mpsc::unbounded_channel::<Packet>();

                        // Initialize forwarder
                        {
                            let mut channels = st.channels.lock().await;
                            if let Some(channel) = channels.get_mut(&c_id) {
                                channel.forwarders.insert(
                                    u_id.clone(),
                                    ForwarderState {
                                        source_user_id: u_id.clone(),
                                        track_id: track_id.clone(),
                                        stream_id: stream_id.clone(),
                                        kind: kind.clone(),
                                        codec: codec.clone(),
                                        destination_tracks: HashMap::new(),
                                        tx: tx_track.clone(),
                                    }
                                );
                            }
                        }

                        broadcast_to_channel(&st, &c_id, &ServerMessage::TrackMap {
                            user_id: u_id.clone(),
                            track_id: track_id.clone(),
                            stream_id: stream_id.clone(),
                            kind: kind.clone(),
                        }, None).await;

                        // Get current members and create destination tracks
                        let members = {
                            let channels = st.channels.lock().await;
                            channels.get(&c_id).map(|c| c.members.clone()).unwrap_or_default()
                        };

                        for member in members {
                            if member == u_id { continue; }

                            let dest_track = Arc::new(TrackLocalStaticRTP::new(
                                codec.clone(),
                                track_id.clone(),
                                stream_id.clone(),
                            ));

                            {
                                let mut channels = st.channels.lock().await;
                                if let Some(channel) = channels.get_mut(&c_id) {
                                    if let Some(forwarder) = channel.forwarders.get_mut(&u_id) {
                                        forwarder.destination_tracks.insert(member.clone(), Arc::clone(&dest_track));
                                    }
                                }
                            }

                            let mut peers = st.peers.lock().await;
                            if let Some(peer) = peers.get_mut(&member) {
                                if let Some(other_pc) = &peer.peer_connection {
                                    if other_pc.add_track(dest_track as Arc<dyn webrtc::track::track_local::TrackLocal + Send + Sync>).await.is_ok() {
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

                        // FIX: Source reading task - handles (Packet, Attributes) tuple
                        tokio::spawn(async move {
                            let mut jitter_buffer = JitterBuffer::new(30, 48000);

                            while let Ok((packet, _)) = track.read_rtp().await {
                                jitter_buffer.push(packet);

                                while let Some(p) = jitter_buffer.pop() {
                                    let _ = tx_track.send(p);
                                }
                            }
                        });

                        // Forwarding worker - reads from channel and distributes
                        tokio::spawn(async move {
                            let mut rx = rx_track;
                            while let Some(packet) = rx.recv().await {
                                let dest_tracks = {
                                    let channels = st.channels.lock().await;
                                    if let Some(channel) = channels.get(&c_id) {
                                        if let Some(forwarder) = channel.forwarders.get(&u_id) {
                                            forwarder.destination_tracks.clone()
                                        } else {
                                            break;
                                        }
                                    } else {
                                        break;
                                    }
                                };

                                for (dest_user, dest_track) in dest_tracks {
                                    let _ = dest_track.write_rtp(&packet).await;

                                    {
                                        let mut channels = st.channels.lock().await;
                                        if let Some(channel) = channels.get_mut(&c_id) {
                                            if let Some(stats) = channel.stats.get_mut(&dest_user) {
                                                stats.update(1, packet.payload.len() as u64);
                                            }
                                        }
                                    }
                                }
                            }
                        });
                    })
                }));

                // CATCH-UP OPTIMIZED: Create tracks for existing sources, then ONE offer for all
                {
                    let mut tracks_to_add: Vec<Arc<TrackLocalStaticRTP>> = Vec::new();
                    let mut track_maps: Vec<ServerMessage> = Vec::new();

                    let channels = state.channels.lock().await;
                    if let Some(channel) = channels.get(&channel_id) {
                        for (source_user_id, forwarder) in &channel.forwarders {
                            if source_user_id == &uid {
                                continue;
                            }

                            track_maps.push(ServerMessage::TrackMap {
                                user_id: source_user_id.clone(),
                                track_id: forwarder.track_id.clone(),
                                stream_id: forwarder.stream_id.clone(),
                                kind: forwarder.kind.clone(),
                            });

                            let dest_track = Arc::new(TrackLocalStaticRTP::new(
                                forwarder.codec.clone(),
                                forwarder.track_id.clone(),
                                forwarder.stream_id.clone(),
                            ));

                            tracks_to_add.push(Arc::clone(&dest_track));

                            {
                                let mut channels = state.channels.lock().await;
                                if let Some(channel) = channels.get_mut(&channel_id) {
                                    if let Some(forwarder) =
                                        channel.forwarders.get_mut(source_user_id)
                                    {
                                        forwarder
                                            .destination_tracks
                                            .insert(uid.clone(), Arc::clone(&dest_track));
                                    }
                                }
                            }
                        }
                    }

                    for track_map in track_maps {
                        broadcast_to_channel(&state, &channel_id, &track_map, Some(&uid)).await;
                    }

                    if let Some(peer) = state.peers.lock().await.get_mut(&uid) {
                        if let Some(pc_ref) = &peer.peer_connection {
                            for track in tracks_to_add {
                                let _ = pc_ref
                                    .add_track(
                                        track
                                            as Arc<
                                                dyn webrtc::track::track_local::TrackLocal
                                                    + Send
                                                    + Sync,
                                            >,
                                    )
                                    .await;
                            }

                            let tx_clone = peer.tx.clone();
                            let pc_clone = Arc::clone(pc_ref);
                            tokio::spawn(async move {
                                if let Ok(offer) = pc_clone.create_offer(None).await {
                                    if pc_clone.set_local_description(offer.clone()).await.is_ok() {
                                        let _ = tx_clone.send(serialize_message(&ServerMessage::Offer {
                                            sdp: serde_json::json!({"type": "offer", "sdp": offer.sdp}),
                                        }).unwrap());
                                    }
                                }
                            });
                        }
                    }
                }

                pc.set_remote_description(RTCSessionDescription::offer(sdp_str).unwrap())
                    .await
                    .unwrap();
                let answer = pc.create_answer(None).await.unwrap();
                pc.set_local_description(answer.clone()).await.unwrap();

                if let Some(peer) = state.peers.lock().await.get_mut(&uid) {
                    peer.peer_connection = Some(Arc::clone(&pc));
                }

                let _ = tx.send(
                    serialize_message(&ServerMessage::Answer {
                        sdp: serde_json::json!({"type": "answer", "sdp": answer.sdp}),
                    })
                    .unwrap(),
                );
            }

            ClientMessage::Answer { sdp } => {
                let uid = current_user_id.clone().unwrap_or_default();
                let sdp_str = sdp["sdp"].as_str().unwrap_or_default().to_string();
                if let Some(peer) = state.peers.lock().await.get(&uid) {
                    if let Some(pc) = &peer.peer_connection {
                        let _ = pc
                            .set_remote_description(RTCSessionDescription::answer(sdp_str).unwrap())
                            .await;
                    }
                }
            }

            ClientMessage::Ice { candidate } => {
                let uid = current_user_id.clone().unwrap_or_default();
                if let Some(peer) = state.peers.lock().await.get(&uid) {
                    if let Some(pc) = &peer.peer_connection {
                        if let Ok(c_init) = serde_json::from_value::<RTCIceCandidateInit>(candidate)
                        {
                            let _ = pc.add_ice_candidate(c_init).await;
                        }
                    }
                }
            }

            ClientMessage::MediaState {
                channel_id,
                user_id,
                is_muted,
                is_deafened,
            } => {
                let uid_for_exclude = user_id.clone();
                if let Some(peer) = state.peers.lock().await.get_mut(&user_id) {
                    peer.is_muted = is_muted;
                    peer.is_deafened = is_deafened;
                }
                broadcast_to_channel(
                    &state,
                    &channel_id.clone(),
                    &ServerMessage::PeerState {
                        channel_id,
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
                    &channel_id.clone(),
                    &ServerMessage::Chat {
                        channel_id,
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
                if let Some(uid) = current_user_id.clone() {
                    remove_peer(&state, &uid).await;
                    current_user_id = None;
                }
            }
        }
    }

    if let Some(user_id) = current_user_id {
        remove_peer(&state, &user_id).await;
    }
    send_task.abort();
}
