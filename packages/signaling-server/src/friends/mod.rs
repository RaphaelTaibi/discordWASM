use std::sync::Arc;

use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::routing::{delete, get, post};
use axum::Router;
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::errors::ApiError;
use crate::models::*;
use crate::negotiate::{accepts_proto, decode_body, negotiate, negotiate_list, Negotiated};
use crate::sfu::broadcast::notify_user;
use crate::sfu::models::ServerMessage;
use crate::sfu::state::AppState;
use crate::store::FriendRecord;

/// Builds the `/api/friends` sub-router.
pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_friends))
        .route("/request", post(send_request))
        .route("/pending", get(list_pending))
        .route("/:id/accept", post(accept_request))
        .route("/:id/reject", post(reject_request))
        .route("/:id", delete(remove_friend))
        .route("/by-user/:user_id", delete(remove_friend_by_user))
}

/// GET /api/friends — accepted friends list
async fn list_friends(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Negotiated, ApiError> {
    let proto = accepts_proto(&headers);
    let auth = AuthUser::from_headers(&headers)?;
    let store = &state.auth_store;
    let friends: Vec<UserSummary> = store
        .friends
        .iter()
        .filter(|r| {
            r.value().status == "accepted"
                && (r.value().from_user_id == auth.user_id
                    || r.value().to_user_id == auth.user_id)
        })
        .filter_map(|r| {
            let other_id = if r.value().from_user_id == auth.user_id {
                &r.value().to_user_id
            } else {
                &r.value().from_user_id
            };
            store.users.get(other_id).map(|u| UserSummary::from(u.value()))
        })
        .collect();

    Ok(negotiate_list(friends, |items| UserSummaryList { items }, proto))
}

/// POST /api/friends/request — send a friend request
async fn send_request(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Negotiated, ApiError> {
    let proto = accepts_proto(&headers);
    let auth = AuthUser::from_headers(&headers)?;
    let body: FriendRequestBody = decode_body(&headers, &body)?;
    let store = &state.auth_store;

    if auth.user_id == body.to_user_id {
        return Err(ApiError::BadRequest("Cannot add yourself".into()));
    }
    if !store.users.contains_key(&body.to_user_id) {
        return Err(ApiError::NotFound("User not found".into()));
    }

    // An existing relationship blocks a new request only when it is still
    // pending or already accepted. Stale `rejected` records are cleared so
    // the user can send a fresh request after a previous decline. The key
    // is cloned only on the stale path (when we actually need to remove it
    // after dropping the DashMap guard) — zero allocations on the hot path.
    let stale_id: Option<String> = {
        let _found = store.friends.iter().find(|r| {
            let f = r.value();
            (f.from_user_id == auth.user_id && f.to_user_id == body.to_user_id)
                || (f.from_user_id == body.to_user_id && f.to_user_id == auth.user_id)
        });
        match _found {
            None => None,
            Some(r) => match r.value().status.as_str() {
                "pending" | "accepted" => {
                    return Err(ApiError::Conflict("Friend request already exists".into()));
                }
                _ => Some(r.key().clone()),
            },
        }
    };
    if let Some(stale) = stale_id {
        store.friends.remove(&stale);
    }

    let id = Uuid::new_v4().to_string();
    let now_ms = epoch_ms();
    let to_user_id = body.to_user_id;

    // Snapshot the sender summary while the user record guard is alive.
    let sender_summary = store
        .users
        .get(&auth.user_id)
        .map(|u| UserSummary::from(u.value()));

    // Insertion forces two `id` clones (map key + struct field) and one
    // `to_user_id` clone (record owns it, the WS push needs `&to_user_id`
    // afterwards). Both are structural to the storage layout.
    store.friends.insert(
        id.clone(),
        FriendRecord {
            id: id.clone(),
            from_user_id: auth.user_id,
            to_user_id: to_user_id.clone(),
            status: "pending".into(),
            created_at_ms: now_ms,
        },
    );
    store.mark_dirty();

    if let Some(from) = sender_summary {
        notify_user(
            &state,
            &to_user_id,
            &ServerMessage::FriendRequestReceived {
                request: PendingRequest {
                    id: id.clone(),
                    from: Some(from),
                    created_at_ms: now_ms,
                },
            },
        )
        .await;
    }

    Ok(negotiate(
        FriendRequestResult { id, status: "pending".into() },
        proto,
    ))
}

/// GET /api/friends/pending — incoming pending requests
async fn list_pending(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Negotiated, ApiError> {
    let proto = accepts_proto(&headers);
    let auth = AuthUser::from_headers(&headers)?;
    let store = &state.auth_store;
    let pending: Vec<PendingRequest> = store
        .friends
        .iter()
        .filter(|r| r.value().to_user_id == auth.user_id && r.value().status == "pending")
        .filter_map(|r| {
            let f = r.value();
            store.users.get(&f.from_user_id).map(|u| PendingRequest {
                id: f.id.clone(),
                from: Some(UserSummary::from(u.value())),
                created_at_ms: f.created_at_ms,
            })
        })
        .collect();

    Ok(negotiate_list(pending, |items| PendingRequestList { items }, proto))
}

/// POST /api/friends/:id/accept
async fn accept_request(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Negotiated, ApiError> {
    let proto = accepts_proto(&headers);
    let auth = AuthUser::from_headers(&headers)?;
    let store = &state.auth_store;

    // Snapshot the original sender id while validating, then release the lock
    // before issuing the WS push to avoid holding a DashMap guard across await.
    let from_user_id = {
        let mut record = store
            .friends
            .get_mut(&id)
            .ok_or_else(|| ApiError::NotFound("Request not found".into()))?;

        if record.to_user_id != auth.user_id || record.status != "pending" {
            return Err(ApiError::BadRequest("Cannot accept this request".into()));
        }

        record.status = "accepted".into();
        record.from_user_id.clone()
    };
    store.mark_dirty();

    let accepter_summary = store
        .users
        .get(&auth.user_id)
        .map(|u| UserSummary::from(u.value()));

    if let Some(friend) = accepter_summary {
        notify_user(
            &state,
            &from_user_id,
            &ServerMessage::FriendRequestAccepted {
                request_id: id,
                friend,
            },
        )
        .await;
    }

    Ok(negotiate(StatusResponse { status: "accepted".into() }, proto))
}

/// POST /api/friends/:id/reject
async fn reject_request(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Negotiated, ApiError> {
    let proto = accepts_proto(&headers);
    let auth = AuthUser::from_headers(&headers)?;
    let store = &state.auth_store;

    let from_user_id = {
        let mut record = store
            .friends
            .get_mut(&id)
            .ok_or_else(|| ApiError::NotFound("Request not found".into()))?;

        if record.to_user_id != auth.user_id || record.status != "pending" {
            return Err(ApiError::BadRequest("Cannot reject this request".into()));
        }

        record.status = "rejected".into();
        record.from_user_id.clone()
    };
    store.mark_dirty();

    notify_user(
        &state,
        &from_user_id,
        &ServerMessage::FriendRequestDeclined {
            request_id: id,
            by_user_id: auth.user_id,
        },
    )
    .await;

    Ok(negotiate(StatusResponse { status: "rejected".into() }, proto))
}

/// DELETE /api/friends/:id — remove a friend / cancel request
async fn remove_friend(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Negotiated, ApiError> {
    let proto = accepts_proto(&headers);
    let auth = AuthUser::from_headers(&headers)?;
    let store = &state.auth_store;

    let snapshot = {
        let record = store
            .friends
            .get(&id)
            .ok_or_else(|| ApiError::NotFound("Friendship not found".into()))?;

        if record.from_user_id != auth.user_id && record.to_user_id != auth.user_id {
            return Err(ApiError::BadRequest("Not your friendship".into()));
        }
        (
            record.from_user_id.clone(),
            record.to_user_id.clone(),
            record.status.clone(),
        )
    };

    store.friends.remove(&id);
    store.mark_dirty();

    let (from, to, status) = snapshot;
    let other = if from == auth.user_id { to } else { from };
    push_removal_event(&state, id, other, auth.user_id, &status).await;

    Ok(negotiate(RemovedResponse { removed: true }, proto))
}

/// DELETE /api/friends/by-user/:user_id — removes friendship with a given user.
async fn remove_friend_by_user(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(target_user_id): Path<String>,
) -> Result<Negotiated, ApiError> {
    let proto = accepts_proto(&headers);
    let auth = AuthUser::from_headers(&headers)?;
    let store = &state.auth_store;

    // Single-pass scan: capture the key + status of the matching friendship
    // and drop the guard before any further mutation. The key is cloned only
    // because DashMap's `remove` requires either an owned key or a `&Q` that
    // outlives the guard, neither of which is available here without the move.
    let entry = {
        let _found = store.friends.iter().find(|r| {
            let f = r.value();
            (f.from_user_id == auth.user_id && f.to_user_id == target_user_id)
                || (f.from_user_id == target_user_id && f.to_user_id == auth.user_id)
        });
        _found.map(|r| (r.key().clone(), r.value().status.clone()))
    };

    let (id, status) = entry.ok_or_else(|| ApiError::NotFound("Friendship not found".into()))?;

    store.friends.remove(&id);
    store.mark_dirty();

    push_removal_event(&state, id, target_user_id, auth.user_id, &status).await;

    Ok(negotiate(RemovedResponse { removed: true }, proto))
}

/// Pushes the right WS event to the *other* party depending on the friendship
/// status at deletion time: pending → cancellation, accepted → removal.
/// Owned strings are moved into the WS payload — no extra allocations beyond
/// the JSON serialization itself.
async fn push_removal_event(
    state: &Arc<AppState>,
    friendship_id: String,
    other_user_id: String,
    actor_user_id: String,
    status: &str,
) {
    match status {
        "pending" => {
            notify_user(
                state,
                &other_user_id,
                &ServerMessage::FriendRequestCancelled {
                    request_id: friendship_id,
                    by_user_id: actor_user_id,
                },
            )
            .await;
        }
        "accepted" => {
            notify_user(
                state,
                &other_user_id,
                &ServerMessage::FriendRemoved {
                    friendship_id,
                    by_user_id: actor_user_id,
                },
            )
            .await;
        }
        _ => {}
    }
}

fn epoch_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
