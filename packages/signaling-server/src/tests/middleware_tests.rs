use axum::http::{HeaderMap, HeaderValue};

use crate::auth::jwt::create_token;
use crate::auth::middleware::AuthUser;

// ---------------------------------------------------------------------------
// 1. Valid Bearer token extracts user_id
// ---------------------------------------------------------------------------

#[test]
fn valid_bearer_extracts_user() {
    let uid = "user-abc";
    let token = create_token(uid).expect("create");
    let mut headers = HeaderMap::new();
    headers.insert(
        "authorization",
        HeaderValue::from_str(&format!("Bearer {token}")).unwrap(),
    );
    let auth = AuthUser::from_headers(&headers).expect("auth");
    assert_eq!(auth.user_id, uid);
}

// ---------------------------------------------------------------------------
// 2. Missing Authorization header → Unauthorized
// ---------------------------------------------------------------------------

#[test]
fn missing_header_is_unauthorized() {
    let headers = HeaderMap::new();
    let result = AuthUser::from_headers(&headers);
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// 3. Authorization header without "Bearer " prefix → Unauthorized
// ---------------------------------------------------------------------------

#[test]
fn wrong_prefix_is_unauthorized() {
    let mut headers = HeaderMap::new();
    headers.insert("authorization", HeaderValue::from_static("Basic abc123"));
    let result = AuthUser::from_headers(&headers);
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// 4. Invalid JWT after "Bearer " → Unauthorized
// ---------------------------------------------------------------------------

#[test]
fn invalid_jwt_is_unauthorized() {
    let mut headers = HeaderMap::new();
    headers.insert(
        "authorization",
        HeaderValue::from_static("Bearer not.a.jwt"),
    );
    let result = AuthUser::from_headers(&headers);
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// 5. Empty Bearer token → Unauthorized
// ---------------------------------------------------------------------------

#[test]
fn empty_bearer_token() {
    let mut headers = HeaderMap::new();
    headers.insert("authorization", HeaderValue::from_static("Bearer "));
    let result = AuthUser::from_headers(&headers);
    assert!(result.is_err());
}
