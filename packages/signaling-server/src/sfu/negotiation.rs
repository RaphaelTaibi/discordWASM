use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::{RwLock, mpsc};
use webrtc::ice_transport::ice_candidate::RTCIceCandidateInit;
use webrtc::ice_transport::ice_server::RTCIceServer;
use webrtc::peer_connection::configuration::RTCConfiguration;
use webrtc::peer_connection::sdp::session_description::RTCSessionDescription;
use webrtc::rtp::packet::Packet;
use webrtc::rtp_transceiver::rtp_codec::RTCRtpCodecCapability;
use webrtc::track::track_local::TrackLocalWriter;
use webrtc::track::track_local::track_local_static_rtp::TrackLocalStaticRTP;

use super::broadcast::{broadcast_to_channel, serialize_message};
use super::models::ServerMessage;
use super::state::{AppState, ForwarderState, JitterBuffer, RTP_CHANNEL_CAPACITY};
use crate::metrics::{RTP_PACKETS_DROPPED, WS_QUEUE_DROPPED};

/// Handles an incoming SDP offer: creates a PeerConnection, sets up
/// track forwarding and produces the SDP answer.
pub async fn handle_offer(
    state: &Arc<AppState>,
    tx: &mpsc::Sender<String>,
    current_user_id: &Option<String>,
    sdp: serde_json::Value,
) {
    let uid = current_user_id.clone().unwrap_or_default();
    let sdp_str = sdp["sdp"].as_str().unwrap_or_default().to_string();
    let channel_id = {
        let peers = state.peers.read().await;
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

    // ICE candidate relay
    let tx_ice = tx.clone();
    pc.on_ice_candidate(Box::new(move |c| {
        let tx_c = tx_ice.clone();
        Box::pin(async move {
            if let Some(candidate) = c {
                let json = candidate.to_json().unwrap();
                if let Some(payload) = serialize_message(&ServerMessage::Ice {
                    candidate: serde_json::to_value(json).unwrap(),
                }) {
                    if tx_c.try_send(payload).is_err() {
                        WS_QUEUE_DROPPED.inc();
                    }
                }
            }
        })
    }));

    // ---- on_track: forward incoming media to all other channel members ----
    let uid_t = uid.clone();
    let channel_id_t = channel_id.clone();
    let state_t = Arc::clone(state);

    pc.on_track(Box::new(move |track, _, _| {
        let u_id = uid_t.clone();
        let c_id = channel_id_t.clone();
        let st = Arc::clone(&state_t);

        Box::pin(async move {
            let track_id = track.id().to_string();
            let stream_id = track.stream_id().to_string();
            let kind = track.kind().to_string();
            let codec = track.codec().capability.clone();

            let (tx_track, rx_track) = mpsc::channel::<Packet>(RTP_CHANNEL_CAPACITY);

            // Shared destination tracks — the forwarding worker reads from
            // this directly, avoiding the global channels lock on every packet.
            let dest_tracks = Arc::new(RwLock::new(HashMap::new()));
            let dest_tracks_for_worker = Arc::clone(&dest_tracks);

            // Register forwarder
            {
                let mut channels = st.channels.write().await;
                if let Some(channel) = channels.get_mut(&c_id) {
                    channel.forwarders.insert(
                        u_id.clone(),
                        ForwarderState {
                            source_user_id: u_id.clone(),
                            track_id: track_id.clone(),
                            stream_id: stream_id.clone(),
                            kind: kind.clone(),
                            codec: codec.clone(),
                            destination_tracks: dest_tracks,
                            tx: tx_track.clone(),
                        },
                    );
                }
            }

            broadcast_to_channel(
                &st,
                &c_id,
                &ServerMessage::TrackMap {
                    user_id: u_id.clone(),
                    track_id: track_id.clone(),
                    stream_id: stream_id.clone(),
                    kind: kind.clone(),
                },
                None,
            )
            .await;

            let members = {
                let channels = st.channels.read().await;
                channels
                    .get(&c_id)
                    .map(|c| c.members.clone())
                    .unwrap_or_default()
            };

            for member in members {
                if member == u_id {
                    continue;
                }

                let dest_track = Arc::new(TrackLocalStaticRTP::new(
                    codec.clone(),
                    track_id.clone(),
                    stream_id.clone(),
                ));

                // Fine-grained lock on destination_tracks only (channels read lock)
                {
                    let channels = st.channels.read().await;
                    if let Some(channel) = channels.get(&c_id) {
                        if let Some(fwd) = channel.forwarders.get(&u_id) {
                            fwd.destination_tracks
                                .write()
                                .await
                                .insert(member.clone(), Arc::clone(&dest_track));
                        }
                    }
                }

                let peers = st.peers.read().await;
                if let Some(peer) = peers.get(&member) {
                    if let Some(other_pc) = &peer.peer_connection {
                        if other_pc
                            .add_track(
                                dest_track
                                    as Arc<
                                        dyn webrtc::track::track_local::TrackLocal + Send + Sync,
                                    >,
                            )
                            .await
                            .is_ok()
                        {
                            let other_tx = peer.tx.clone();
                            let other_pc_clone = Arc::clone(other_pc);
                            tokio::spawn(async move {
                                if let Ok(offer) = other_pc_clone.create_offer(None).await {
                                    if other_pc_clone
                                        .set_local_description(offer.clone())
                                        .await
                                        .is_ok()
                                    {
                                        if let Some(payload) = serialize_message(&ServerMessage::Offer {
                                            sdp: serde_json::json!({"type": "offer", "sdp": offer.sdp}),
                                        }) {
                                            if other_tx.try_send(payload).is_err() {
                                                WS_QUEUE_DROPPED.inc();
                                            }
                                        }
                                    }
                                }
                            });
                        }
                    }
                }
            }

            // Source reader → jitter buffer → channel
            tokio::spawn(async move {
                let mut jitter_buffer = JitterBuffer::new(30, 48000);
                while let Ok((packet, _)) = track.read_rtp().await {
                    jitter_buffer.push(packet);
                    while let Some(p) = jitter_buffer.pop() {
                        if tx_track.try_send(p).is_err() {
                            RTP_PACKETS_DROPPED.inc();
                        }
                    }
                }
            });

            // Forwarding worker — reads destination tracks from the shared
            // Arc<RwLock> and batches stats updates every 500ms to minimise
            // write-lock contention on the global channels map.
            {
                let st_fwd = Arc::clone(&st);
                let c_id_fwd = c_id.clone();
                tokio::spawn(async move {
                    let mut rx = rx_track;
                    let mut local_stats: HashMap<String, (u64, u64)> = HashMap::new();
                    let mut last_flush = Instant::now();

                    while let Some(packet) = rx.recv().await {
                        let payload_len = packet.payload.len() as u64;

                        // Snapshot destination tracks (fine-grained read lock)
                        let snapshot: Vec<(String, Arc<TrackLocalStaticRTP>)> = {
                            let tracks = dest_tracks_for_worker.read().await;
                            tracks
                                .iter()
                                .map(|(k, v)| (k.clone(), Arc::clone(v)))
                                .collect()
                        };

                        if snapshot.is_empty() {
                            continue;
                        }

                        for (dest_user, dest_track) in &snapshot {
                            let _ = dest_track.write_rtp(&packet).await;
                            let entry =
                                local_stats.entry(dest_user.clone()).or_insert((0, 0));
                            entry.0 += 1;
                            entry.1 += payload_len;
                        }

                        // Batch stats flush every 500ms
                        if last_flush.elapsed() >= Duration::from_millis(500) {
                            if !local_stats.is_empty() {
                                let mut channels = st_fwd.channels.write().await;
                                if let Some(channel) = channels.get_mut(&c_id_fwd) {
                                    for (uid, (pkts, bytes)) in local_stats.drain() {
                                        if let Some(stats) = channel.stats.get_mut(&uid)
                                        {
                                            stats.update(pkts, bytes);
                                        }
                                    }
                                }
                            }
                            last_flush = Instant::now();
                        }
                    }
                });
            }
        })
    }));

    // ---- Catch-up: snapshot existing forwarders, then create dest tracks ----
    catchup_existing_tracks(state, &uid, &channel_id).await;

    // ---- SDP exchange ----
    pc.set_remote_description(RTCSessionDescription::offer(sdp_str).unwrap())
        .await
        .unwrap();
    let answer = pc.create_answer(None).await.unwrap();
    pc.set_local_description(answer.clone()).await.unwrap();

    if let Some(peer) = state.peers.write().await.get_mut(&uid) {
        peer.peer_connection = Some(Arc::clone(&pc));
    }

    if let Some(payload) = serialize_message(&ServerMessage::Answer {
        sdp: serde_json::json!({"type": "answer", "sdp": answer.sdp}),
    }) {
        if tx.try_send(payload).is_err() {
            WS_QUEUE_DROPPED.inc();
        }
    }
}

/// Catches up a newly-joined peer with every existing track source in
/// the channel. Snapshots forwarder data first to avoid nested locks.
async fn catchup_existing_tracks(state: &Arc<AppState>, uid: &str, channel_id: &str) {
    // Phase 1 — read-only snapshot (lock released immediately)
    let forwarder_snapshot: Vec<(String, RTCRtpCodecCapability, String, String, String)> = {
        let channels = state.channels.read().await;
        channels
            .get(channel_id)
            .map(|ch| {
                ch.forwarders
                    .iter()
                    .filter(|(src_id, _)| *src_id != uid)
                    .map(|(src_id, f)| {
                        (
                            src_id.clone(),
                            f.codec.clone(),
                            f.track_id.clone(),
                            f.stream_id.clone(),
                            f.kind.clone(),
                        )
                    })
                    .collect()
            })
            .unwrap_or_default()
    };

    let mut tracks_to_add: Vec<Arc<TrackLocalStaticRTP>> = Vec::new();
    let mut track_maps: Vec<ServerMessage> = Vec::new();

    // Phase 2 — create destination tracks (channels read + fine-grained dest write)
    for (source_user_id, codec, track_id, stream_id, kind) in forwarder_snapshot {
        track_maps.push(ServerMessage::TrackMap {
            user_id: source_user_id.clone(),
            track_id: track_id.clone(),
            stream_id: stream_id.clone(),
            kind,
        });

        let dest_track = Arc::new(TrackLocalStaticRTP::new(codec, track_id, stream_id));
        tracks_to_add.push(Arc::clone(&dest_track));

        let channels = state.channels.read().await;
        if let Some(channel) = channels.get(channel_id) {
            if let Some(fwd) = channel.forwarders.get(&source_user_id) {
                fwd.destination_tracks
                    .write()
                    .await
                    .insert(uid.to_string(), Arc::clone(&dest_track));
            }
        }
    }

    // Phase 3 — broadcast track-maps to other peers
    for track_map in track_maps {
        broadcast_to_channel(state, channel_id, &track_map, Some(uid)).await;
    }

    // Phase 4 — add all tracks to the new peer's PC, send ONE renegotiation offer
    let peer_data = {
        let peers = state.peers.read().await;
        peers.get(uid).map(|p| (p.peer_connection.clone(), p.tx.clone()))
    };

    if let Some((Some(pc_ref), tx_clone)) = peer_data {
        for track in tracks_to_add {
            let _ = pc_ref
                .add_track(
                    track as Arc<dyn webrtc::track::track_local::TrackLocal + Send + Sync>,
                )
                .await;
        }

        let pc_clone = Arc::clone(&pc_ref);
        tokio::spawn(async move {
            if let Ok(offer) = pc_clone.create_offer(None).await {
                if pc_clone.set_local_description(offer.clone()).await.is_ok() {
                    if let Some(payload) = serialize_message(&ServerMessage::Offer {
                        sdp: serde_json::json!({"type": "offer", "sdp": offer.sdp}),
                    }) {
                        if tx_clone.try_send(payload).is_err() {
                            WS_QUEUE_DROPPED.inc();
                        }
                    }
                }
            }
        });
    }
}

/// Handles an incoming SDP answer.
pub async fn handle_answer(
    state: &Arc<AppState>,
    current_user_id: &Option<String>,
    sdp: serde_json::Value,
) {
    let uid = current_user_id.clone().unwrap_or_default();
    let sdp_str = sdp["sdp"].as_str().unwrap_or_default().to_string();
    if let Some(peer) = state.peers.read().await.get(&uid) {
        if let Some(pc) = &peer.peer_connection {
            let _ = pc
                .set_remote_description(RTCSessionDescription::answer(sdp_str).unwrap())
                .await;
        }
    }
}

/// Handles an incoming ICE candidate.
pub async fn handle_ice(
    state: &Arc<AppState>,
    current_user_id: &Option<String>,
    candidate: serde_json::Value,
) {
    let uid = current_user_id.clone().unwrap_or_default();
    if let Some(peer) = state.peers.read().await.get(&uid) {
        if let Some(pc) = &peer.peer_connection {
            if let Ok(c_init) = serde_json::from_value::<RTCIceCandidateInit>(candidate) {
                let _ = pc.add_ice_candidate(c_init).await;
            }
        }
    }
}
