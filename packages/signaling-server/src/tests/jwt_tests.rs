use crate::auth::jwt::{create_token, decode_token};

// ---------------------------------------------------------------------------
// 1. Round-trip: create → decode returns correct sub claim
// ---------------------------------------------------------------------------

#[test]
fn roundtrip_create_decode() {
    let uid = "user-42";
    let token = create_token(uid).expect("create");
    let claims = decode_token(&token).expect("decode");
    assert_eq!(claims.sub, uid);
}

// ---------------------------------------------------------------------------
// 2. Token expiry is in the future (~7 days)
// ---------------------------------------------------------------------------

#[test]
fn token_expiry_in_future() {
    let token = create_token("u1").expect("create");
    let claims = decode_token(&token).expect("decode");
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as usize;
    assert!(claims.exp > now);
    assert!(claims.exp <= now + 7 * 24 * 3600 + 5);
}

// ---------------------------------------------------------------------------
// 3. Decoding a garbage token fails
// ---------------------------------------------------------------------------

#[test]
fn decode_garbage_fails() {
    let result = decode_token("this.is.not.a.jwt");
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// 4. Different user IDs produce different tokens
// ---------------------------------------------------------------------------

#[test]
fn different_users_different_tokens() {
    let t1 = create_token("user-1").expect("create");
    let t2 = create_token("user-2").expect("create");
    assert_ne!(t1, t2);
}

// ---------------------------------------------------------------------------
// 5. Decode returns the correct user_id across multiple calls
// ---------------------------------------------------------------------------

#[test]
fn multiple_tokens_decode_correctly() {
    for i in 0..50 {
        let uid = format!("user-{i}");
        let token = create_token(&uid).expect("create");
        let claims = decode_token(&token).expect("decode");
        assert_eq!(claims.sub, uid);
    }
}
