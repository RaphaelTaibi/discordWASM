use crate::auth::jwt;
use crate::errors::ApiError;
use axum::http::HeaderMap;

/// Authenticated user extracted from the `Authorization: Bearer <token>` header.
pub struct AuthUser {
    pub user_id: String,
}

impl AuthUser {
    /// Validates the JWT from request headers and returns the authenticated user.
    pub fn from_headers(headers: &HeaderMap) -> Result<Self, ApiError> {
        let header = headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| ApiError::Unauthorized("Missing Authorization header".into()))?;

        let token = header
            .strip_prefix("Bearer ")
            .ok_or_else(|| ApiError::Unauthorized("Invalid Authorization format".into()))?;

        let claims = jwt::decode_token(token)?;
        Ok(AuthUser {
            user_id: claims.sub,
        })
    }
}
