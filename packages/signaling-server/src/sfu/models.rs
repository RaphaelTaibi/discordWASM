use serde::{Deserialize, Serialize};

use crate::models::{PendingRequest, UserSummary};

// ---------------------------------------------------------------------------
// Server / Channel data types (used at runtime and in REST API)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerChannel {
    pub id: String,
    pub name: String,
    pub r#type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Server {
    pub id: String,
    pub name: String,
    pub owner_public_key: String,
    pub invite_key: String,
    pub icon: Option<String>,
    pub channels: Vec<ServerChannel>,
    #[serde(default)]
    pub members: Vec<String>,
}

// ---------------------------------------------------------------------------
// WebSocket protocol — Client → Server
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum ClientMessage {
    #[serde(rename_all = "camelCase")]
    Join {
        channel_id: String,
        user_id: String,
        username: String,
        fingerprint: Option<String>,
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

    // -----------------------------------------------------------------------
    // WS-only flows (Phase 3) — replace per-feature REST polling
    // -----------------------------------------------------------------------
    /// Validates the JWT and binds the authenticated user_id to the WS
    /// connection. Required before issuing any RPC call.
    #[serde(rename_all = "camelCase")]
    Authenticate { token: String },

    /// Subscribes the WS to push events for a *text* channel. The server
    /// pushes new chat messages to every subscriber regardless of voice
    /// channel membership.
    #[serde(rename_all = "camelCase")]
    SubscribeChannel { channel_id: String },

    #[serde(rename_all = "camelCase")]
    UnsubscribeChannel { channel_id: String },

    /// Subscribes to server-level events: member join/leave + presence.
    #[serde(rename_all = "camelCase")]
    SubscribeServer { server_id: String },

    #[serde(rename_all = "camelCase")]
    UnsubscribeServer { server_id: String },

    /// Generic request/response envelope. The host routes `method` to the
    /// matching handler and replies with [`ServerMessage::RpcResult`] keyed
    /// by `request_id`.
    #[serde(rename_all = "camelCase")]
    Rpc {
        request_id: String,
        method: String,
        #[serde(default)]
        params: serde_json::Value,
    },
}

// ---------------------------------------------------------------------------
// WebSocket protocol — Server → Client
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum ServerMessage {
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

    // ---- Friend social events (unchanged) ----
    #[serde(rename_all = "camelCase")]
    FriendRequestReceived {
        request: PendingRequest,
    },
    #[serde(rename_all = "camelCase")]
    FriendRequestAccepted {
        request_id: String,
        friend: UserSummary,
    },
    #[serde(rename_all = "camelCase")]
    FriendRequestDeclined {
        request_id: String,
        by_user_id: String,
    },
    #[serde(rename_all = "camelCase")]
    FriendRequestCancelled {
        request_id: String,
        by_user_id: String,
    },
    #[serde(rename_all = "camelCase")]
    FriendRemoved {
        friendship_id: String,
        by_user_id: String,
    },

    // ---- Phase 3 WS-only events ----
    /// Acknowledges an `Authenticate` call. `ok = false` means the WS is
    /// still anonymous and must NOT issue authenticated RPCs.
    #[serde(rename_all = "camelCase")]
    Authenticated {
        user_id: String,
        ok: bool,
    },

    /// One member's online presence on a server changed.
    #[serde(rename_all = "camelCase")]
    ServerMemberPresence {
        server_id: String,
        user_id: String,
        online: bool,
    },

    /// A new member just joined a server (e.g. accepted invite).
    #[serde(rename_all = "camelCase")]
    ServerMemberAdded {
        server_id: String,
        member: UserSummary,
    },

    /// A member left or was removed.
    #[serde(rename_all = "camelCase")]
    ServerMemberRemoved {
        server_id: String,
        user_id: String,
    },

    /// Generic RPC reply matching a [`ClientMessage::Rpc`] by `request_id`.
    /// Exactly one of `result` / `error` is non-null.
    #[serde(rename_all = "camelCase")]
    RpcResult {
        request_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        result: Option<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<RpcError>,
    },
}

/// Structured RPC error. `code` is a stable string the client can branch on.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RpcError {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerInfo {
    pub user_id: String,
    pub username: String,
    pub is_muted: bool,
    pub is_deafened: bool,
}
