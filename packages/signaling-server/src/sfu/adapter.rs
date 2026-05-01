//! Adapter bridging void-sfu's [`SignalSink`] / [`RoomObserver`] to the
//! signaling-server WebSocket protocol.

use std::sync::Arc;

use async_trait::async_trait;
use tokio::sync::mpsc;
use tracing::debug;
use void_sfu::{Outbound, PeerId, RoomEvent, RoomObserver, SfuError, SfuResult, SignalSink};

use super::broadcast::serialize_message;
use super::models::{PeerInfo, ServerMessage};
use super::state::AppState;
use crate::metrics::WS_QUEUE_DROPPED;

/// Per-peer sink: owns a clone of the peer's outbound mpsc.
///
/// One instance is created per WebSocket and registered with the SFU when
/// the peer first identifies itself (via `Join`). The sink ignores the
/// `peer` argument because the underlying transport is point-to-point;
/// the SFU still passes it for symmetry with multi-peer transports.
pub(crate) struct WsPeerSink {
    tx: mpsc::Sender<String>,
}

impl WsPeerSink {
    pub fn new(tx: mpsc::Sender<String>) -> Self {
        Self { tx }
    }
}

#[async_trait]
impl SignalSink for WsPeerSink {
    async fn deliver(&self, _peer: &PeerId, message: Outbound) -> SfuResult<()> {
        let server_msg = match message {
            Outbound::Offer { sdp } => ServerMessage::Offer { sdp },
            Outbound::Answer { sdp } => ServerMessage::Answer { sdp },
            Outbound::Ice { candidate } => ServerMessage::Ice { candidate },
            Outbound::TrackMap {
                source_peer,
                track_id,
                stream_id,
                kind,
            } => ServerMessage::TrackMap {
                user_id: source_peer.to_string(),
                track_id,
                stream_id,
                kind,
            },
        };

        let payload = serialize_message(&server_msg)
            .ok_or(SfuError::Internal("failed to serialize ServerMessage"))?;

        if self.tx.try_send(payload).is_err() {
            WS_QUEUE_DROPPED.inc();
        }
        Ok(())
    }
}

/// Observer that broadcasts room membership transitions as WebSocket
/// `peer-joined` / `peer-left` messages to all remaining peers.
pub(crate) struct WsRoomObserver {
    state: Arc<AppState>,
}

impl WsRoomObserver {
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }
}

#[async_trait]
impl RoomObserver for WsRoomObserver {
    async fn on_event(&self, event: RoomEvent) {
        match event {
            RoomEvent::PeerJoined { room, peer } => {
                let info = match self.state.peer_info(&peer).await {
                    Some(i) => i,
                    None => {
                        debug!("PeerJoined for unknown peer {}", peer);
                        return;
                    }
                };
                let msg = ServerMessage::PeerJoined {
                    channel_id: room.to_string(),
                    peer: info,
                };
                self.broadcast_excluding(&room, &msg, &peer).await;
            }
            RoomEvent::PeerLeft { room, peer } => {
                let msg = ServerMessage::PeerLeft {
                    channel_id: room.to_string(),
                    user_id: peer.to_string(),
                };
                self.broadcast_excluding(&room, &msg, &peer).await;
            }
        }
    }
}

impl WsRoomObserver {
    async fn broadcast_excluding(
        &self,
        room: &void_sfu::RoomId,
        msg: &ServerMessage,
        exclude: &PeerId,
    ) {
        let Some(payload) = serialize_message(msg) else { return };
        let members = self.state.sfu.room_members(room);
        let peers = self.state.peers.read().await;
        for member in members {
            if member.as_str() == exclude.as_str() {
                continue;
            }
            if let Some(peer) = peers.get(member.as_str()) {
                if peer.tx.try_send(payload.clone()).is_err() {
                    WS_QUEUE_DROPPED.inc();
                }
            }
        }
    }
}

/// Helper extension exposed on AppState for resolving a [`PeerInfo`] by id.
impl AppState {
    pub async fn peer_info(&self, peer: &PeerId) -> Option<PeerInfo> {
        let peers = self.peers.read().await;
        peers.get(peer.as_str()).map(|p| PeerInfo {
            user_id: p.user_id.clone(),
            username: p.username.clone(),
            is_muted: p.is_muted,
            is_deafened: p.is_deafened,
        })
    }
}

