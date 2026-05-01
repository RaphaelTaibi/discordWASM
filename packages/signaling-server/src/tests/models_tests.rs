use crate::models::*;
use crate::store::UserRecord;

/// Helper: builds a full UserRecord for conversion tests.
fn sample_user() -> UserRecord {
    UserRecord {
        id: "uid-1".into(),
        username: "alice".into(),
        display_name: "Alice W.".into(),
        password_hash: Some("legacy-hash".into()),
        avatar: Some("https://img.example.com/a.png".into()),
        public_key: Some("pk-base64".into()),
        created_at_ms: 1_700_000_000_000,
    }
}

// ---------------------------------------------------------------------------
// 1. UserProfile::from preserves all public fields
// ---------------------------------------------------------------------------

#[test]
fn user_profile_from_record() {
    let u = sample_user();
    let p = UserProfile::from(&u);

    assert_eq!(p.id, "uid-1");
    assert_eq!(p.username, "alice");
    assert_eq!(p.display_name, "Alice W.");
    assert_eq!(p.avatar, Some("https://img.example.com/a.png".into()));
    assert_eq!(p.public_key, Some("pk-base64".into()));
    assert_eq!(p.created_at_ms, 1_700_000_000_000);
}

// ---------------------------------------------------------------------------
// 2. UserProfile::from does NOT leak password_hash
// ---------------------------------------------------------------------------

#[test]
fn user_profile_no_password() {
    let p = UserProfile::from(&sample_user());
    // UserProfile has no password_hash field — compilation guarantees this.
    // Serialization check: password must be absent from JSON output.
    let json = serde_json::to_value(&p).unwrap();
    assert!(json.get("password_hash").is_none());
    assert!(json.get("passwordHash").is_none());
}

// ---------------------------------------------------------------------------
// 3. UserSummary::from preserves fields (no created_at_ms)
// ---------------------------------------------------------------------------

#[test]
fn user_summary_from_record() {
    let u = sample_user();
    let s = UserSummary::from(&u);

    assert_eq!(s.id, "uid-1");
    assert_eq!(s.username, "alice");
    assert_eq!(s.display_name, "Alice W.");
    assert_eq!(s.avatar, Some("https://img.example.com/a.png".into()));
    assert_eq!(s.public_key, Some("pk-base64".into()));
}

// ---------------------------------------------------------------------------
// 4. UserSummary::from with no avatar / no public_key
// ---------------------------------------------------------------------------

#[test]
fn user_summary_optional_fields_none() {
    let u = UserRecord {
        id: "uid-2".into(),
        username: "bob".into(),
        display_name: "Bob".into(),
        password_hash: None,
        avatar: None,
        public_key: None,
        created_at_ms: 0,
    };
    let s = UserSummary::from(&u);
    assert!(s.avatar.is_none());
    assert!(s.public_key.is_none());
}

// ---------------------------------------------------------------------------
// 5. StatusResponse serializes to JSON correctly
// ---------------------------------------------------------------------------

#[test]
fn status_response_json() {
    let sr = StatusResponse {
        status: "accepted".into(),
    };
    let json = serde_json::to_value(&sr).unwrap();
    assert_eq!(json["status"], "accepted");
}

// ---------------------------------------------------------------------------
// 6. FriendRequestResult JSON round-trip
// ---------------------------------------------------------------------------

#[test]
fn friend_request_result_json() {
    let r = FriendRequestResult {
        id: "fr-1".into(),
        status: "pending".into(),
    };
    let json = serde_json::to_string(&r).unwrap();
    assert!(json.contains("fr-1"));
    assert!(json.contains("pending"));
}

// ---------------------------------------------------------------------------
// 7. RemovedResponse serializes correctly
// ---------------------------------------------------------------------------

#[test]
fn removed_response_json() {
    let r = RemovedResponse { removed: true };
    let json = serde_json::to_value(&r).unwrap();
    assert_eq!(json["removed"], true);
}

// ---------------------------------------------------------------------------
// 8. AuthResponse contains both token and user
// ---------------------------------------------------------------------------

#[test]
fn auth_response_structure() {
    let profile = UserProfile::from(&sample_user());
    let ar = AuthResponse {
        token: "jwt-token".into(),
        user: Some(profile),
    };
    let json = serde_json::to_value(&ar).unwrap();
    assert_eq!(json["token"], "jwt-token");
    assert!(json["user"].is_object());
}

// ---------------------------------------------------------------------------
// 9. PendingRequest with embedded sender
// ---------------------------------------------------------------------------

#[test]
fn pending_request_structure() {
    let sender = UserSummary::from(&sample_user());
    let pr = PendingRequest {
        id: "req-1".into(),
        from: Some(sender),
        created_at_ms: 1_700_000_000_000,
    };
    let json = serde_json::to_value(&pr).unwrap();
    assert!(json["from"].is_object());
    assert_eq!(json["id"], "req-1");
}

// ---------------------------------------------------------------------------
// 10. Protobuf round-trip for UserProfile
// ---------------------------------------------------------------------------

#[test]
fn user_profile_protobuf_roundtrip() {
    use prost::Message;
    let p = UserProfile::from(&sample_user());
    let buf = p.encode_to_vec();
    let decoded = UserProfile::decode(buf.as_slice()).unwrap();
    assert_eq!(p, decoded);
}

// ---------------------------------------------------------------------------
// 11. Protobuf round-trip for UserSummaryList
// ---------------------------------------------------------------------------

#[test]
fn user_summary_list_protobuf_roundtrip() {
    use prost::Message;
    let list = UserSummaryList {
        items: vec![
            UserSummary::from(&sample_user()),
            UserSummary {
                id: "uid-2".into(),
                username: "bob".into(),
                display_name: "Bob".into(),
                avatar: None,
                public_key: None,
            },
        ],
    };
    let buf = list.encode_to_vec();
    let decoded = UserSummaryList::decode(buf.as_slice()).unwrap();
    assert_eq!(decoded.items.len(), 2);
}

// ---------------------------------------------------------------------------
// 12. SearchQuery deserializes from query string
// ---------------------------------------------------------------------------

#[test]
fn search_query_deserialize() {
    let q: SearchQuery = serde_json::from_str(r#"{"q":"test"}"#).unwrap();
    assert_eq!(q.q, "test");
}
