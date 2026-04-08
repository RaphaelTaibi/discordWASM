use std::sync::LazyLock;

use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use crate::models::Claims;

/// JWT secret cached at process start — avoids env-var lookup + heap allocation per call.
static JWT_SECRET: LazyLock<Vec<u8>> = LazyLock::new(|| {
    std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "dev-secret-change-in-prod".into())
        .into_bytes()
});

/// Creates a signed JWT valid for 7 days.
pub fn create_token(user_id: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let exp = (std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
        + 7 * 24 * 3600) as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        exp,
    };
    encode(&Header::default(), &claims, &EncodingKey::from_secret(&JWT_SECRET))
}

/// Decodes and validates a JWT, returning the embedded claims.
pub fn decode_token(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(&JWT_SECRET),
        &Validation::default(),
    )?;
    Ok(data.claims)
}
