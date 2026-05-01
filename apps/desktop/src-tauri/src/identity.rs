use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use argon2::password_hash::SaltString;
use argon2::{self, Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use base64::{engine::general_purpose, Engine as _};
use ed25519_dalek::{Signer, SigningKey};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use tauri::Manager;

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

/// Full identity metadata stored on disk (includes the password hash).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityMeta {
    pub timestamp: u64,
    pub public_key: String,
    pub pseudo: String,
    #[serde(default)]
    pub password_hash: String,
    #[serde(default)]
    pub avatar: Option<String>,
}

/// Public-facing identity returned to the frontend (no sensitive fields).
#[derive(Debug, Clone, Serialize)]
pub struct IdentityMetaPublic {
    pub timestamp: u64,
    pub public_key: String,
    pub pseudo: String,
    pub avatar: Option<String>,
}

impl From<&IdentityMeta> for IdentityMetaPublic {
    fn from(m: &IdentityMeta) -> Self {
        Self {
            timestamp: m.timestamp,
            public_key: m.public_key.clone(),
            pseudo: m.pseudo.clone(),
            avatar: m.avatar.clone(),
        }
    }
}

/// Secret material for an identity (never leaves the backend).
#[derive(Debug, Clone, Serialize, Deserialize)]
struct IdentitySecret {
    pub public_key: String,
    pub private_key: String,
}

/// Legacy single-file identity format used before the split.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct LegacyIdentity {
    pub timestamp: String,
    pub private_key: String,
    pub public_key: String,
    pub pseudo: String,
}

/// In-memory cache keyed by `public_key`. Avoids disk reads on every lookup.
pub struct IdentityCache(pub Mutex<HashMap<String, IdentityMeta>>);

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

fn config_dir(app: &tauri::AppHandle) -> PathBuf {
    let path = app
        .path()
        .app_config_dir()
        .expect("Failed to get app config dir");
    let _ = fs::create_dir_all(&path);
    path
}

fn get_meta_path(app: &tauri::AppHandle) -> PathBuf {
    config_dir(app).join("identities_meta.json")
}

fn get_secrets_path(app: &tauri::AppHandle) -> PathBuf {
    config_dir(app).join("identities_secrets.json")
}

fn get_legacy_path(app: &tauri::AppHandle) -> PathBuf {
    config_dir(app).join("identities.json")
}

// ---------------------------------------------------------------------------
// Atomic write (write-then-rename) with backup rotation
// ---------------------------------------------------------------------------

/// Creates a `.bak` copy of `path` before any write, if the file has content.
fn rotate_backup(path: &PathBuf) {
    if !path.exists() {
        return;
    }
    if let Ok(meta) = fs::metadata(path) {
        if meta.len() == 0 {
            return;
        }
    }
    let bak = path.with_extension("json.bak");
    let _ = fs::copy(path, bak);
}

/// Writes `content` to `path` atomically via a temporary file.
/// On Windows the target is removed first since `fs::rename` cannot overwrite.
/// A `.bak` copy of the previous file is kept for crash recovery.
fn atomic_write(path: &PathBuf, content: &str) -> Result<(), String> {
    // Safety: refuse to write empty or near-empty content over a non-empty file
    if content.len() <= 2 {
        if let Ok(existing) = fs::metadata(path) {
            if existing.len() > 2 {
                return Err("Refusing to overwrite non-empty file with empty content".into());
            }
        }
    }

    rotate_backup(path);

    let tmp = path.with_extension("tmp");
    fs::write(&tmp, content).map_err(|e| format!("tmp write failed: {e}"))?;

    if path.exists() {
        fs::remove_file(path).map_err(|e| format!("remove target failed: {e}"))?;
    }
    fs::rename(&tmp, path).map_err(|e| format!("rename failed: {e}"))
}

// ---------------------------------------------------------------------------
// Disk I/O (low-level)
// ---------------------------------------------------------------------------

/// Reads identity metadata from disk, falling back to `.bak` on failure.
fn read_metas_from_disk(app: &tauri::AppHandle) -> Vec<IdentityMeta> {
    let path = get_meta_path(app);

    // Primary read
    if let Some(metas) = fs::read_to_string(&path)
        .ok()
        .filter(|d| d.len() > 2)
        .and_then(|d| serde_json::from_str(&d).ok())
    {
        return metas;
    }

    // Fallback: try .bak file
    let bak = path.with_extension("json.bak");
    if let Some(metas) = fs::read_to_string(&bak)
        .ok()
        .filter(|d| d.len() > 2)
        .and_then(|d| serde_json::from_str::<Vec<IdentityMeta>>(&d).ok())
    {
        eprintln!("Recovered {} identities from backup file", metas.len());
        // Restore the primary file from backup
        let _ = fs::copy(&bak, &path);
        return metas;
    }

    Vec::new()
}

fn flush_cache_to_disk(
    app: &tauri::AppHandle,
    cache: &HashMap<String, IdentityMeta>,
) -> Result<(), String> {
    let metas: Vec<&IdentityMeta> = cache.values().collect();
    let json = serde_json::to_string_pretty(&metas).map_err(|e| e.to_string())?;
    atomic_write(&get_meta_path(app), &json)
}

/// Reads secrets from disk, falling back to `.bak` on failure.
fn read_secrets(app: &tauri::AppHandle) -> Vec<IdentitySecret> {
    let path = get_secrets_path(app);

    if let Some(secrets) = fs::read_to_string(&path)
        .ok()
        .filter(|d| d.len() > 2)
        .and_then(|d| serde_json::from_str(&d).ok())
    {
        return secrets;
    }

    // Fallback: try .bak file
    let bak = path.with_extension("json.bak");
    if let Some(secrets) = fs::read_to_string(&bak)
        .ok()
        .filter(|d| d.len() > 2)
        .and_then(|d| serde_json::from_str::<Vec<IdentitySecret>>(&d).ok())
    {
        eprintln!("Recovered {} secrets from backup file", secrets.len());
        let _ = fs::copy(&bak, &path);
        return secrets;
    }

    Vec::new()
}

fn write_secrets(app: &tauri::AppHandle, secrets: &[IdentitySecret]) -> Result<(), String> {
    let json = serde_json::to_string_pretty(secrets).map_err(|e| e.to_string())?;
    atomic_write(&get_secrets_path(app), &json)
}

// ---------------------------------------------------------------------------
// Password hashing helpers
// ---------------------------------------------------------------------------

/// Hashes a password with Argon2id and a random salt.
fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| format!("password hash failed: {e}"))
}

/// Verifies a password against a stored Argon2id hash.
fn verify_password(password: &str, stored_hash: &str) -> Result<bool, String> {
    let parsed = PasswordHash::new(stored_hash).map_err(|e| format!("invalid stored hash: {e}"))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

// ---------------------------------------------------------------------------
// Initialization & Migration
// ---------------------------------------------------------------------------

/// Builds an `IdentityCache` from disk, running legacy migration first if needed.
/// Only re-flushes to normalize the schema when identities were actually loaded.
pub fn init_cache(app: &tauri::AppHandle) -> IdentityCache {
    if let Err(e) = migrate_legacy(app) {
        eprintln!("Identity migration warning: {e}");
    }

    let metas = read_metas_from_disk(app);
    let map: HashMap<String, IdentityMeta> = metas
        .into_iter()
        .map(|m| (m.public_key.clone(), m))
        .collect();

    // Re-flush to normalize schema, but only when there are identities to persist
    if !map.is_empty() {
        if let Err(e) = flush_cache_to_disk(app, &map) {
            eprintln!("Schema normalization flush failed: {e}");
        }
    }

    IdentityCache(Mutex::new(map))
}

/// Splits the old `identities.json` into the new two-file format.
fn migrate_legacy(app: &tauri::AppHandle) -> Result<(), String> {
    let legacy_path = get_legacy_path(app);
    let meta_path = get_meta_path(app);

    if !legacy_path.exists() || meta_path.exists() {
        return Ok(());
    }

    let data = fs::read_to_string(&legacy_path).map_err(|e| format!("legacy read failed: {e}"))?;
    let legacy: Vec<LegacyIdentity> =
        serde_json::from_str(&data).map_err(|e| format!("legacy parse failed: {e}"))?;

    let metas: Vec<IdentityMeta> = legacy
        .iter()
        .map(|l| IdentityMeta {
            timestamp: l.timestamp.parse::<u64>().unwrap_or(0),
            public_key: l.public_key.clone(),
            pseudo: l.pseudo.clone(),
            password_hash: String::new(),
            avatar: None,
        })
        .collect();

    let secrets: Vec<IdentitySecret> = legacy
        .iter()
        .map(|l| IdentitySecret {
            public_key: l.public_key.clone(),
            private_key: l.private_key.clone(),
        })
        .collect();

    let json = serde_json::to_string_pretty(&metas).map_err(|e| e.to_string())?;
    atomic_write(&meta_path, &json)?;
    write_secrets(app, &secrets)?;

    let bak = legacy_path.with_extension("json.bak");
    let _ = fs::rename(&legacy_path, bak);

    Ok(())
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

/// Generates an Ed25519 keypair with a password, stores the identity.
#[tauri::command]
pub fn create_identity(
    app: tauri::AppHandle,
    cache: tauri::State<'_, IdentityCache>,
    pseudo: String,
    password: String,
) -> Result<IdentityMetaPublic, String> {
    let pseudo = pseudo.trim().to_string();
    if pseudo.len() < 2 {
        return Err("Pseudo must be at least 2 characters".into());
    }
    if password.len() < 4 {
        return Err("Password must be at least 4 characters".into());
    }

    let mut map = cache.0.lock().map_err(|_| "Cache lock poisoned")?;
    let mut csprng = OsRng;
    let signing_key = SigningKey::generate(&mut csprng);
    let verifying_key = signing_key.verifying_key();

    let pub_key = general_purpose::STANDARD.encode(verifying_key.to_bytes());
    let priv_key = general_purpose::STANDARD.encode(signing_key.to_bytes());

    let meta = IdentityMeta {
        timestamp: epoch_now(),
        public_key: pub_key.clone(),
        pseudo,
        password_hash: hash_password(&password)?,
        avatar: None,
    };

    // Write secret to disk (never cached in RAM)
    let mut secrets = read_secrets(&app);
    secrets.push(IdentitySecret {
        public_key: pub_key.clone(),
        private_key: priv_key,
    });
    write_secrets(&app, &secrets)?;

    let public = IdentityMetaPublic::from(&meta);
    map.insert(pub_key, meta);
    flush_cache_to_disk(&app, &map)?;

    Ok(public)
}

/// Recovers an identity by pseudo + password. If multiple identities share the
/// same display name, the password is tested against each until a match is found.
#[tauri::command]
pub fn recover_identity(
    cache: tauri::State<'_, IdentityCache>,
    pseudo: String,
    password: String,
) -> Result<IdentityMetaPublic, String> {
    let map = cache.0.lock().map_err(|_| "Cache lock poisoned")?;
    let trimmed = pseudo.trim();

    let candidates: Vec<&IdentityMeta> = map
        .values()
        .filter(|m| m.pseudo.eq_ignore_ascii_case(trimmed))
        .collect();

    if candidates.is_empty() {
        return Err("Identity not found".into());
    }

    for meta in &candidates {
        if meta.password_hash.is_empty() {
            continue;
        }
        if verify_password(&password, &meta.password_hash).unwrap_or(false) {
            return Ok(IdentityMetaPublic::from(*meta));
        }
    }

    Err("Invalid password".into())
}

/// Finds an identity's public metadata by its public key (in-memory lookup).
#[tauri::command]
pub fn find_identity_by_pubkey(
    cache: tauri::State<'_, IdentityCache>,
    public_key: String,
) -> Result<IdentityMetaPublic, String> {
    let map = cache.0.lock().map_err(|_| "Cache lock poisoned")?;
    map.get(&public_key)
        .map(IdentityMetaPublic::from)
        .ok_or_else(|| "Identity not found".into())
}

/// Updates the pseudo for an existing identity (secrets are never touched).
#[tauri::command]
pub fn update_identity_pseudo(
    app: tauri::AppHandle,
    cache: tauri::State<'_, IdentityCache>,
    public_key: String,
    new_pseudo: String,
) -> Result<IdentityMetaPublic, String> {
    let new_pseudo = new_pseudo.trim().to_string();
    let mut map = cache.0.lock().map_err(|_| "Cache lock poisoned")?;

    let meta = map.get_mut(&public_key).ok_or("Identity not found")?;
    meta.pseudo = new_pseudo;
    let public = IdentityMetaPublic::from(&*meta);
    flush_cache_to_disk(&app, &map)?;

    Ok(public)
}

/// Max avatar payload size (~512 KB base64 ≈ ~384 KB image).
const MAX_AVATAR_SIZE: usize = 512 * 1024;

/// Updates or removes the avatar for an existing identity.
#[tauri::command]
pub fn update_identity_avatar(
    app: tauri::AppHandle,
    cache: tauri::State<'_, IdentityCache>,
    public_key: String,
    avatar_data: Option<String>,
) -> Result<IdentityMetaPublic, String> {
    if let Some(ref data) = avatar_data {
        if data.len() > MAX_AVATAR_SIZE {
            return Err("Avatar too large (max 512 KB)".into());
        }
    }

    let mut map = cache.0.lock().map_err(|_| "Cache lock poisoned")?;

    let meta = map.get_mut(&public_key).ok_or("Identity not found")?;
    meta.avatar = avatar_data;
    let public = IdentityMetaPublic::from(&*meta);
    flush_cache_to_disk(&app, &map)?;

    Ok(public)
}

/// Signs an arbitrary message with the Ed25519 private key of the given identity.
/// Returns the signature as a base64 string.
#[tauri::command]
pub fn sign_message(
    app: tauri::AppHandle,
    public_key: String,
    message: String,
) -> Result<String, String> {
    let secrets = read_secrets(&app);
    let secret = secrets
        .iter()
        .find(|s| s.public_key == public_key)
        .ok_or("Private key not found for this identity")?;

    let key_bytes = general_purpose::STANDARD
        .decode(&secret.private_key)
        .map_err(|e| format!("base64 decode private key: {e}"))?;

    let signing_key = SigningKey::from_bytes(
        key_bytes
            .as_slice()
            .try_into()
            .map_err(|_| "Invalid key length")?,
    );

    let signature = signing_key.sign(message.as_bytes());
    Ok(general_purpose::STANDARD.encode(signature.to_bytes()))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// UNIX-epoch timestamp in seconds (no external crate needed).
fn epoch_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;

    // ──────────────── hash / verify password ─────────────────

    #[test]
    fn hash_and_verify_password_success() {
        let hash = hash_password("test-password").unwrap();
        assert!(hash.starts_with("$argon2"));
        assert!(verify_password("test-password", &hash).unwrap());
    }

    #[test]
    fn verify_password_wrong_input() {
        let hash = hash_password("correct").unwrap();
        assert!(!verify_password("wrong", &hash).unwrap());
    }

    #[test]
    fn verify_password_invalid_hash_format() {
        assert!(verify_password("pwd", "not-a-valid-hash").is_err());
    }

    #[test]
    fn hash_password_unique_salts() {
        let h1 = hash_password("same").unwrap();
        let h2 = hash_password("same").unwrap();
        assert_ne!(h1, h2, "different salts should produce different hashes");
    }

    #[test]
    fn hash_password_empty_string() {
        let hash = hash_password("").unwrap();
        assert!(verify_password("", &hash).unwrap());
        assert!(!verify_password("notempty", &hash).unwrap());
    }

    // ──────────────────── epoch_now ──────────────────────────

    #[test]
    fn epoch_now_after_2024() {
        assert!(epoch_now() > 1_704_067_200);
    }

    #[test]
    fn epoch_now_monotonic() {
        let t1 = epoch_now();
        let t2 = epoch_now();
        assert!(t2 >= t1);
    }

    // ─────────────── IdentityMeta defaults ──────────────────

    #[test]
    fn identity_meta_empty_pseudo() {
        let meta = IdentityMeta {
            timestamp: 0,
            public_key: String::new(),
            pseudo: String::new(),
            password_hash: String::new(),
            avatar: None,
        };
        let public = IdentityMetaPublic::from(&meta);
        assert_eq!(public.pseudo, "");
    }

    #[test]
    fn identity_meta_public_clone_independence() {
        let meta = IdentityMeta {
            timestamp: 10,
            public_key: "pk".into(),
            pseudo: "name".into(),
            password_hash: "hash".into(),
            avatar: Some("av".into()),
        };
        let p1 = IdentityMetaPublic::from(&meta);
        let p2 = IdentityMetaPublic::from(&meta);
        assert_eq!(p1.public_key, p2.public_key);
        assert_eq!(p1.avatar, p2.avatar);
    }

    // ─────────────── IdentityCache basic ────────────────────

    #[test]
    fn identity_cache_starts_empty() {
        let cache = IdentityCache(Mutex::new(HashMap::new()));
        let map = cache.0.lock().unwrap();
        assert!(map.is_empty());
    }

    #[test]
    fn identity_cache_insert_and_retrieve() {
        let cache = IdentityCache(Mutex::new(HashMap::new()));
        {
            let mut map = cache.0.lock().unwrap();
            map.insert(
                "pk1".into(),
                IdentityMeta {
                    timestamp: 1,
                    public_key: "pk1".into(),
                    pseudo: "Alice".into(),
                    password_hash: String::new(),
                    avatar: None,
                },
            );
        }
        let map = cache.0.lock().unwrap();
        assert_eq!(map.len(), 1);
        assert_eq!(map.get("pk1").unwrap().pseudo, "Alice");
    }

    // ──────────── MAX_AVATAR_SIZE constant ──────────────────

    #[test]
    fn max_avatar_size_is_512kb() {
        assert_eq!(MAX_AVATAR_SIZE, 512 * 1024);
    }
}
