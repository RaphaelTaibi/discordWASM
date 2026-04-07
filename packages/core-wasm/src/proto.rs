//! Protobuf message types mirroring the signaling-server API contract.
//! Tag numbers MUST stay in sync with `packages/signaling-server/src/models.rs`.

use prost::Message;
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

#[derive(Clone, PartialEq, Message, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    #[prost(string, tag = "1")]
    pub id: String,
    #[prost(string, tag = "2")]
    pub username: String,
    #[prost(string, tag = "3")]
    pub display_name: String,
    #[prost(string, optional, tag = "4")]
    pub avatar: Option<String>,
    #[prost(string, optional, tag = "5")]
    pub public_key: Option<String>,
    #[prost(int64, tag = "6")]
    pub created_at_ms: i64,
}

#[derive(Clone, PartialEq, Message, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSummary {
    #[prost(string, tag = "1")]
    pub id: String,
    #[prost(string, tag = "2")]
    pub username: String,
    #[prost(string, tag = "3")]
    pub display_name: String,
    #[prost(string, optional, tag = "4")]
    pub avatar: Option<String>,
}

#[derive(Clone, PartialEq, Message, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthResponse {
    #[prost(string, tag = "1")]
    pub token: String,
    #[prost(message, optional, tag = "2")]
    pub user: Option<UserProfile>,
}

#[derive(Clone, PartialEq, Message, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingRequest {
    #[prost(string, tag = "1")]
    pub id: String,
    #[prost(message, optional, tag = "2")]
    pub from: Option<UserSummary>,
    #[prost(int64, tag = "3")]
    pub created_at_ms: i64,
}

#[derive(Clone, PartialEq, Message, Serialize, Deserialize)]
pub struct StatusResponse {
    #[prost(string, tag = "1")]
    pub status: String,
}

#[derive(Clone, PartialEq, Message, Serialize, Deserialize)]
pub struct FriendRequestResult {
    #[prost(string, tag = "1")]
    pub id: String,
    #[prost(string, tag = "2")]
    pub status: String,
}

#[derive(Clone, PartialEq, Message, Serialize, Deserialize)]
pub struct RemovedResponse {
    #[prost(bool, tag = "1")]
    pub removed: bool,
}

// ---------------------------------------------------------------------------
// List wrappers
// ---------------------------------------------------------------------------

#[derive(Clone, PartialEq, Message, Serialize, Deserialize)]
pub struct UserSummaryList {
    #[prost(message, repeated, tag = "1")]
    pub items: Vec<UserSummary>,
}

#[derive(Clone, PartialEq, Message, Serialize, Deserialize)]
pub struct PendingRequestList {
    #[prost(message, repeated, tag = "1")]
    pub items: Vec<PendingRequest>,
}

// ---------------------------------------------------------------------------
// API request types
// ---------------------------------------------------------------------------

#[derive(Clone, PartialEq, Message, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterBody {
    #[prost(string, tag = "1")]
    pub username: String,
    #[prost(string, tag = "2")]
    pub password: String,
    #[prost(string, tag = "3")]
    pub display_name: String,
    #[prost(string, optional, tag = "4")]
    pub public_key: Option<String>,
}

#[derive(Clone, PartialEq, Message, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginBody {
    #[prost(string, tag = "1")]
    pub username: String,
    #[prost(string, tag = "2")]
    pub password: String,
}

#[derive(Clone, PartialEq, Message, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileBody {
    #[prost(string, optional, tag = "1")]
    pub display_name: Option<String>,
    #[prost(string, optional, tag = "2")]
    pub avatar: Option<String>,
}

#[derive(Clone, PartialEq, Message, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendRequestBody {
    #[prost(string, tag = "1")]
    pub to_user_id: String,
}

