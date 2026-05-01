use axum::http::StatusCode;
use axum::response::IntoResponse;

use crate::errors::ApiError;

// ---------------------------------------------------------------------------
// 1. Each variant maps to the correct HTTP status code
// ---------------------------------------------------------------------------

#[test]
fn bad_request_status() {
    let resp = ApiError::BadRequest("oops".into()).into_response();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

#[test]
fn unauthorized_status() {
    let resp = ApiError::Unauthorized("nope".into()).into_response();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[test]
fn forbidden_status() {
    let resp = ApiError::Forbidden("denied".into()).into_response();
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);
}

#[test]
fn not_found_status() {
    let resp = ApiError::NotFound("gone".into()).into_response();
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
}

#[test]
fn conflict_status() {
    let resp = ApiError::Conflict("dup".into()).into_response();
    assert_eq!(resp.status(), StatusCode::CONFLICT);
}

#[test]
fn too_many_requests_status() {
    let resp = ApiError::TooManyRequests("slow".into()).into_response();
    assert_eq!(resp.status(), StatusCode::TOO_MANY_REQUESTS);
}

#[test]
fn internal_status() {
    let resp = ApiError::Internal("boom".into()).into_response();
    assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
}

// ---------------------------------------------------------------------------
// 2. From<jsonwebtoken::errors::Error> produces Unauthorized
// ---------------------------------------------------------------------------

#[test]
fn jwt_error_converts_to_unauthorized() {
    let jwt_err = jsonwebtoken::decode::<crate::models::Claims>(
        "bad.token.here",
        &jsonwebtoken::DecodingKey::from_secret(b"s"),
        &jsonwebtoken::Validation::default(),
    )
    .unwrap_err();

    let api_err: ApiError = jwt_err.into();
    let resp = api_err.into_response();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}
