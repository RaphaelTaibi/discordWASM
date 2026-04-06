use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use argon2::{self, Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::SaltString;
use base64::{engine::general_purpose, Engine as _};
use ed25519_dalek::SigningKey;
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
    let path = app.path().app_config_dir().expect("Failed to get app config dir");
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
// Atomic write (write-then-rename)
// ---------------------------------------------------------------------------

/// Writes `content` to `path` atomically via a temporary file.
/// On Windows the target is removed first since `fs::rename` cannot overwrite.
fn atomic_write(path: &PathBuf, content: &str) -> Result<(), String> {
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

fn read_metas_from_disk(app: &tauri::AppHandle) -> Vec<IdentityMeta> {
    let path = get_meta_path(app);
    fs::read_to_string(path)
        .ok()
        .and_then(|d| serde_json::from_str(&d).ok())
        .unwrap_or_default()
}

fn flush_cache_to_disk(app: &tauri::AppHandle, cache: &HashMap<String, IdentityMeta>) -> Result<(), String> {
    let metas: Vec<&IdentityMeta> = cache.values().collect();
    let json = serde_json::to_string_pretty(&metas).map_err(|e| e.to_string())?;
    atomic_write(&get_meta_path(app), &json)
}

fn read_secrets(app: &tauri::AppHandle) -> Vec<IdentitySecret> {
    let path = get_secrets_path(app);
    fs::read_to_string(path)
        .ok()
        .and_then(|d| serde_json::from_str(&d).ok())
        .unwrap_or_default()
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
    let parsed = PasswordHash::new(stored_hash)
        .map_err(|e| format!("invalid stored hash: {e}"))?;
    Ok(Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok())
}

// ---------------------------------------------------------------------------
// Initialization & Migration
// ---------------------------------------------------------------------------

/// Builds an `IdentityCache` from disk, running legacy migration first if needed.
pub fn init_cache(app: &tauri::AppHandle) -> IdentityCache {
    if let Err(e) = migrate_legacy(app) {
        eprintln!("Identity migration warning: {e}");
    }

    let metas = read_metas_from_disk(app);
    let map: HashMap<String, IdentityMeta> = metas
        .into_iter()
        .map(|m| (m.public_key.clone(), m))
        .collect();

    IdentityCache(Mutex::new(map))
}

/// Splits the old `identities.json` into the new two-file format.
fn migrate_legacy(app: &tauri::AppHandle) -> Result<(), String> {
    let legacy_path = get_legacy_path(app);
    let meta_path = get_meta_path(app);

    if !legacy_path.exists() || meta_path.exists() {
        return Ok(());
    }

    let data = fs::read_to_string(&legacy_path)
        .map_err(|e| format!("legacy read failed: {e}"))?;
    let legacy: Vec<LegacyIdentity> = serde_json::from_str(&data)
        .map_err(|e| format!("legacy parse failed: {e}"))?;

    let metas: Vec<IdentityMeta> = legacy.iter().map(|l| IdentityMeta {
        timestamp: l.timestamp.parse::<u64>().unwrap_or(0),
        public_key: l.public_key.clone(),
        pseudo: l.pseudo.clone(),
        password_hash: String::new(),
        avatar: None,
    }).collect();

    let secrets: Vec<IdentitySecret> = legacy.iter().map(|l| IdentitySecret {
        public_key: l.public_key.clone(),
        private_key: l.private_key.clone(),
    }).collect();

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
    secrets.push(IdentitySecret { public_key: pub_key.clone(), private_key: priv_key });
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

    let candidates: Vec<&IdentityMeta> = map.values()
        .filter(|m| m.pseudo.eq_ignore_ascii_case(trimmed))
        .collect();

    if candidates.is_empty() {
        return Err("Identity not found".into());
    }

    for meta in &candidates {
        if meta.password_hash.is_empty() { continue; }
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
    map.get(&public_key).map(IdentityMetaPublic::from).ok_or_else(|| "Identity not found".into())
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
