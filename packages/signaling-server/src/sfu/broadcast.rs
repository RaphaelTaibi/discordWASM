use std::sync::Arc;

use super::models::ServerMessage;
use super::state::AppState;
use crate::metrics::WS_QUEUE_DROPPED;

/// Serializes a server message to JSON.
pub fn serialize_message(message: &ServerMessage) -> Option<String> {
    serde_json::to_string(message).ok()
}

/// Pushes a server message to a single user (by id) if currently connected.
/// No-op when the user is offline; drops are accounted for in `WS_QUEUE_DROPPED`.
pub async fn notify_user(state: &Arc<AppState>, user_id: &str, message: &ServerMessage) {
    let payload = match serialize_message(message) {
        Some(p) => p,
        None => return,
    };
    let peers = state.peers.read().await;
    if let Some(peer) = peers.get(user_id) {
        if peer.tx.try_send(payload).is_err() {
            WS_QUEUE_DROPPED.inc();
        }
    }
}

/// Broadcasts a JSON payload to every member of a channel.
pub async fn broadcast_to_channel(
    state: &Arc<AppState>,
    channel_id: &str,
    message: &ServerMessage,
    exclude: Option<&str>,
) {
    let payload = match serialize_message(message) {
        Some(p) => p,
        None => return,
    };
    let members = {
        let channels = state.channels.read().await;
        channels
            .get(channel_id)
            .map(|c| c.members.clone())
            .unwrap_or_default()
    };
    let peers = state.peers.read().await;
    for member in members {
        if exclude == Some(member.as_str()) {
            continue;
        }
        if let Some(peer) = peers.get(&member) {
            if peer.tx.try_send(payload.clone()).is_err() {
                WS_QUEUE_DROPPED.inc();
            }
        }
    }
}

/// Cleans up a peer: closes its PeerConnection, removes forwarders,
/// destination tracks, channel membership, and notifies remaining peers.
pub async fn remove_peer(state: &Arc<AppState>, user_id: &str) {
    let channel_id = {
        let peers = state.peers.read().await;
        peers
            .get(user_id)
            .map(|p| p.channel_id.clone())
            .unwrap_or_default()
    };

    let removed = {
        let mut peers = state.peers.write().await;
        peers.remove(user_id)
    };

    if let Some(peer) = removed {
        if let Some(pc) = peer.peer_connection {
            let _ = pc.close().await;
        }

        {
            let mut channels = state.channels.write().await;
            if let Some(channel) = channels.get_mut(&channel_id) {
                channel
                    .forwarders
                    .retain(|_, f| f.source_user_id != user_id);
                for forwarder in channel.forwarders.values() {
                    forwarder.destination_tracks.write().await.remove(user_id);
                }
                channel.stats.remove(user_id);
                channel.members.remove(user_id);
            }
            // Drop empty channels
            if channels
                .get(&channel_id)
                .map_or(false, |c| c.members.is_empty())
            {
                channels.remove(&channel_id);
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
