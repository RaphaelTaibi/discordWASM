use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use serde::Serialize;
use tokio::sync::{RwLock, mpsc};
use void_sfu::Sfu;
use super::registry::ServerRegistry;
use super::subscriptions::Subscriptions;
use crate::store::Store;
/// Max queued WebSocket JSON messages per peer before dropping.
pub const WS_CHANNEL_CAPACITY: usize = 512;
/// Max chat messages kept in-memory per channel.
pub const CHAT_HISTORY_CAP: usize = 200;
/// Single persisted chat message kept in the in-memory ring buffer.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatEntry {
    pub id: String,
    pub channel_id: String,
    pub from: String,
    pub username: String,
    pub message: String,
    pub timestamp: u64,
}
/// Per-peer host metadata. All WebRTC state lives inside the `Sfu` instance.
#[derive(Clone)]
pub struct PeerSession {
    pub user_id: String,
    pub username: String,
    pub channel_id: String,
    pub tx: mpsc::Sender<String>,
    pub is_muted: bool,
    pub is_deafened: bool,
}
/// Shared application state available to all handlers.
pub struct AppState {
    pub peers: RwLock<HashMap<String, PeerSession>>,
    pub chat_history: RwLock<HashMap<String, VecDeque<ChatEntry>>>,
    pub server_registry: ServerRegistry,
    pub sfu: Sfu,
    pub auth_store: Store,
    /// WS-only push subscriptions (text channels, server presence).
    pub subscriptions: Arc<Subscriptions>,
}
