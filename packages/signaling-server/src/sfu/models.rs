use serde::{Deserialize, Serialize};

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
    Answer { sdp: serde_json::Value },
    #[serde(rename_all = "camelCase")]
    Offer { sdp: serde_json::Value },
    #[serde(rename_all = "camelCase")]
    Ice { candidate: serde_json::Value },
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
    Error { message: String },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerInfo {
    pub user_id: String,
    pub username: String,
    pub is_muted: bool,
    pub is_deafened: bool,
}

