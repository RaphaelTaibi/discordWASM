use core_wasm::proto::*;
/// Protobuf encode/decode round-trip tests.
use prost::Message;

// ───────────────────────── RegisterBody ───────────────────────

#[test]
fn register_body_roundtrip() {
    let body = RegisterBody {
        username: "alice".into(),
        display_name: "Alice".into(),
        public_key: "pk123".into(),
        nonce: "n1".into(),
        signature: "sig1".into(),
    };
    let bytes = body.encode_to_vec();
    let decoded = RegisterBody::decode(bytes.as_slice()).unwrap();
    assert_eq!(decoded.username, "alice");
    assert_eq!(decoded.display_name, "Alice");
    assert_eq!(decoded.public_key, "pk123");
    assert_eq!(decoded.nonce, "n1");
    assert_eq!(decoded.signature, "sig1");
}

// ───────────────────────── LoginBody ─────────────────────────

#[test]
fn login_body_roundtrip() {
    let body = LoginBody {
        public_key: "pk-login".into(),
        nonce: "n2".into(),
        signature: "sig2".into(),
    };
    let bytes = body.encode_to_vec();
    let decoded = LoginBody::decode(bytes.as_slice()).unwrap();
    assert_eq!(decoded.public_key, "pk-login");
    assert_eq!(decoded.nonce, "n2");
}

// ───────────────────────── AuthResponse ──────────────────────

#[test]
fn auth_response_roundtrip() {
    let resp = AuthResponse {
        token: "jwt-token".into(),
        user: Some(UserProfile {
            id: "u1".into(),
            username: "alice".into(),
            display_name: "Alice".into(),
            avatar: Some("https://img.com/a.png".into()),
            public_key: Some("pk1".into()),
            created_at_ms: 1700000000000,
        }),
    };
    let bytes = resp.encode_to_vec();
    let decoded = AuthResponse::decode(bytes.as_slice()).unwrap();
    assert_eq!(decoded.token, "jwt-token");
    let user = decoded.user.unwrap();
    assert_eq!(user.id, "u1");
    assert_eq!(user.username, "alice");
    assert_eq!(user.display_name, "Alice");
    assert_eq!(user.avatar, Some("https://img.com/a.png".into()));
    assert_eq!(user.created_at_ms, 1700000000000);
}

// ───────────────────────── UserSummary / List ────────────────

#[test]
fn user_summary_list_roundtrip() {
    let list = UserSummaryList {
        items: vec![
            UserSummary {
                id: "u1".into(),
                username: "alice".into(),
                display_name: "Alice".into(),
                avatar: None,
                public_key: Some("pk1".into()),
            },
            UserSummary {
                id: "u2".into(),
                username: "bob".into(),
                display_name: "Bob".into(),
                avatar: Some("av".into()),
                public_key: None,
            },
        ],
    };
    let bytes = list.encode_to_vec();
    let decoded = UserSummaryList::decode(bytes.as_slice()).unwrap();
    assert_eq!(decoded.items.len(), 2);
    assert_eq!(decoded.items[0].username, "alice");
    assert_eq!(decoded.items[1].avatar, Some("av".into()));
}

// ───────────────────────── PendingRequest / List ─────────────

#[test]
fn pending_request_list_roundtrip() {
    let list = PendingRequestList {
        items: vec![PendingRequest {
            id: "req1".into(),
            from: Some(UserSummary {
                id: "u3".into(),
                username: "eve".into(),
                display_name: "Eve".into(),
                avatar: None,
                public_key: None,
            }),
            created_at_ms: 123456789,
        }],
    };
    let bytes = list.encode_to_vec();
    let decoded = PendingRequestList::decode(bytes.as_slice()).unwrap();
    assert_eq!(decoded.items.len(), 1);
    assert_eq!(decoded.items[0].id, "req1");
    assert_eq!(decoded.items[0].from.as_ref().unwrap().username, "eve");
}

// ───────────────── StatusResponse / FriendRequestResult / RemovedResponse ──

#[test]
fn status_response_roundtrip() {
    let msg = StatusResponse {
        status: "ok".into(),
    };
    let decoded = StatusResponse::decode(msg.encode_to_vec().as_slice()).unwrap();
    assert_eq!(decoded.status, "ok");
}

#[test]
fn friend_request_result_roundtrip() {
    let msg = FriendRequestResult {
        id: "fr1".into(),
        status: "pending".into(),
    };
    let decoded = FriendRequestResult::decode(msg.encode_to_vec().as_slice()).unwrap();
    assert_eq!(decoded.id, "fr1");
    assert_eq!(decoded.status, "pending");
}

#[test]
fn removed_response_roundtrip() {
    let msg = RemovedResponse { removed: true };
    let decoded = RemovedResponse::decode(msg.encode_to_vec().as_slice()).unwrap();
    assert!(decoded.removed);
}

// ───────────────────────── UpdateProfileBody ─────────────────

#[test]
fn update_profile_body_roundtrip() {
    let body = UpdateProfileBody {
        display_name: Some("NewName".into()),
        avatar: None,
        public_key: Some("pk-new".into()),
    };
    let decoded = UpdateProfileBody::decode(body.encode_to_vec().as_slice()).unwrap();
    assert_eq!(decoded.display_name, Some("NewName".into()));
    assert_eq!(decoded.avatar, None);
    assert_eq!(decoded.public_key, Some("pk-new".into()));
}

// ───────────────────────── FriendRequestBody ─────────────────

#[test]
fn friend_request_body_roundtrip() {
    let body = FriendRequestBody {
        to_user_id: "u42".into(),
    };
    let decoded = FriendRequestBody::decode(body.encode_to_vec().as_slice()).unwrap();
    assert_eq!(decoded.to_user_id, "u42");
}

// ───────────────────────── Empty decode ──────────────────────

#[test]
fn empty_bytes_decode_gives_defaults() {
    let decoded = StatusResponse::decode(&[] as &[u8]).unwrap();
    assert_eq!(decoded.status, "");
}
