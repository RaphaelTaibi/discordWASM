pub mod identity;

use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use sha2::{Sha256, Digest};
use base64::{engine::general_purpose, Engine as _};
use serde::{Serialize, Deserialize};

use rustls::client::danger::{ServerCertVerified, ServerCertVerifier, HandshakeSignatureValid};
use rustls::{DigitallySignedStruct, Error, SignatureScheme};
use rustls_pki_types::{CertificateDer, UnixTime, ServerName};

use tauri::{Manager, Emitter, Listener};

// --- CONFIGURATION PINNING ---
const PRIMARY_PIN: &str = "JZnp4wOHrwvdpPtDzwptWkD//NH4oiGY2rP/3GmAZWI=";
const BACKUP_PIN: &str = "DEV_PIN";

#[derive(Debug)]
struct MyVerifier;

impl ServerCertVerifier for MyVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, Error> {
        let cert_der = end_entity.as_ref();
        let mut hasher = Sha256::new();
        hasher.update(cert_der);
        let hash = hasher.finalize();
        let hash_base64 = general_purpose::STANDARD.encode(hash);

        if hash_base64 == PRIMARY_PIN || hash_base64 == BACKUP_PIN {
            Ok(ServerCertVerified::assertion())
        } else {
            Err(Error::InvalidCertificate(rustls::CertificateError::UnknownIssuer))
        }
    }

    fn verify_tls12_signature(&self, _m: &[u8], _c: &CertificateDer<'_>, _d: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, Error> { Ok(HandshakeSignatureValid::assertion()) }
    fn verify_tls13_signature(&self, _m: &[u8], _c: &CertificateDer<'_>, _d: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, Error> { Ok(HandshakeSignatureValid::assertion()) }
    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> { vec![SignatureScheme::RSA_PSS_SHA256, SignatureScheme::ECDSA_NISTP256_SHA256, SignatureScheme::ED25519] }
}

// --- BENTO LAYOUT ENGINE (fraction-based: 0.0–1.0) ---

const MARGIN_FRAC: f64 = 0.0;
const MIN_W_PX: f64 = 150.0;
const MIN_H_PX: f64 = 100.0;

/// Per-panel minimum sizes in pixels. Compact panels (bars) need smaller minimums.
fn min_sizes_for(id: &str) -> (f64, f64) {
    match id {
        "friends-bar" | "server-bar" => (48.0, 48.0),
        _ => (MIN_W_PX, MIN_H_PX),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutWindow {
    pub id: String,
    /// Horizontal position as fraction of container width (0.0–1.0)
    pub x: f64,
    /// Vertical position as fraction of container height (0.0–1.0)
    pub y: f64,
    /// Width as fraction of container width (0.0–1.0)
    pub w: f64,
    /// Height as fraction of container height (0.0–1.0)
    pub h: f64,
    pub z: i32,
}

#[derive(Default)]
pub struct LayoutState {
    pub windows: Mutex<HashMap<String, LayoutWindow>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MovePayload {
    pub id: String,
    pub dx: f64,
    pub dy: f64,
    pub container_w: f64,
    pub container_h: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ResizePayload {
    pub id: String,
    pub dw: f64,
    pub dh: f64,
    pub container_w: f64,
    pub container_h: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SwapPayload {
    pub id: String,
    pub container_w: f64,
    pub container_h: f64,
}

#[derive(Serialize, Clone)]
struct LayoutBatch {
    windows: Vec<LayoutWindow>,
}

// --- PERSISTENCE ---

fn get_layout_path(app: &tauri::AppHandle) -> PathBuf {
    let path = app.path().app_config_dir().expect("Failed to get app config dir");
    let _ = fs::create_dir_all(&path);
    path.join("layout.json")
}

fn sync_and_save(app: &tauri::AppHandle, windows: &HashMap<String, LayoutWindow>) {
    let batch = LayoutBatch { windows: windows.values().cloned().collect() };
    let _ = app.emit("bento:layout:update", &batch);

    let app_clone = app.clone();
    let data_clone = windows.clone();
    tauri::async_runtime::spawn(async move {
        // Debounce simple pour éviter trop d'écritures disque
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        let path = get_layout_path(&app_clone);
        if let Ok(json) = serde_json::to_string_pretty(&data_clone) {
            let _ = fs::write(path, json);
        }
    });
}

fn load_layout_from_disk(app: &tauri::AppHandle) -> Option<HashMap<String, LayoutWindow>> {
    let path = get_layout_path(app);
    let data = fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

/// Provides sensible default panel positions as fractions of the container.
fn default_layout() -> HashMap<String, LayoutWindow> {
    let mut map = HashMap::new();
    map.insert("sidebar".into(), LayoutWindow { id: "sidebar".into(), x: 0.0, y: 0.1161, w: 0.1559, h: 0.8839, z: 20 });
    map.insert("channel-panel".into(), LayoutWindow { id: "channel-panel".into(), x: 0.156, y: 0.1212, w: 0.6419, h: 0.8788, z: 10 });
    map.insert("chat-panel".into(), LayoutWindow { id: "chat-panel".into(), x: 0.7967, y: 0.117, w: 0.2033, h: 0.883, z: 30 });
    map.insert("friends-bar".into(), LayoutWindow { id: "friends-bar".into(), x: 0.4138, y: 0.005, w: 0.2188, h: 0.048, z: 25 });
    map.insert("server-bar".into(), LayoutWindow { id: "server-bar".into(), x: 0.0005, y: 0.0, w: 0.1133, h: 0.0698, z: 0 });
    map
}

/// Detects legacy pixel-based layouts persisted before the fraction migration.
fn is_legacy_pixel_layout(map: &HashMap<String, LayoutWindow>) -> bool {
    map.values().any(|w| w.x > 2.0 || w.y > 2.0 || w.w > 2.0 || w.h > 2.0)
}

// --- HANDLERS ---

pub fn handle_move(state: &LayoutState, payload: MovePayload, app: &tauri::AppHandle) -> Result<(), String> {
    let mut windows = state.windows.lock().map_err(|_| "Mutex Poisoned")?;

    let win = windows.entry(payload.id.clone()).or_insert(LayoutWindow {
        id: payload.id.clone(), x: 0.05, y: 0.07, w: 0.17, h: 0.56, z: 0,
    });

    // Convert pixel deltas to fraction deltas
    if payload.container_w > 0.0 && payload.container_h > 0.0 {
        win.x += payload.dx / payload.container_w;
        win.y += payload.dy / payload.container_h;
    }

    let max_x = (1.0 - win.w - MARGIN_FRAC).max(MARGIN_FRAC);
    let max_y = (1.0 - win.h - MARGIN_FRAC).max(MARGIN_FRAC);

    win.x = win.x.clamp(MARGIN_FRAC, max_x);
    win.y = win.y.clamp(MARGIN_FRAC, max_y);

    sync_and_save(app, &windows);
    Ok(())
}

pub fn handle_resize(state: &LayoutState, payload: ResizePayload, app: &tauri::AppHandle) -> Result<(), String> {
    let mut windows = state.windows.lock().map_err(|_| "Mutex Poisoned")?;

    let win = windows.entry(payload.id.clone()).or_insert(LayoutWindow {
        id: payload.id.clone(), x: 0.05, y: 0.07, w: 0.17, h: 0.56, z: 0,
    });

    if payload.container_w > 0.0 && payload.container_h > 0.0 {
        win.w += payload.dw / payload.container_w;
        win.h += payload.dh / payload.container_h;
    }

    let (mw_px, mh_px) = min_sizes_for(&payload.id);
    let min_w = if payload.container_w > 0.0 { mw_px / payload.container_w } else { 0.03 };
    let min_h = if payload.container_h > 0.0 { mh_px / payload.container_h } else { 0.03 };

    let max_w = (1.0 - win.x - MARGIN_FRAC).max(min_w);
    let max_h = (1.0 - win.y - MARGIN_FRAC).max(min_h);

    win.w = win.w.clamp(min_w, max_w);
    win.h = win.h.clamp(min_h, max_h);

    sync_and_save(app, &windows);
    Ok(())
}

/// Swaps width and height of a panel (pixel-aware fraction conversion).
/// Used when toggling a panel between horizontal and vertical orientation.
pub fn handle_swap(state: &LayoutState, payload: SwapPayload, app: &tauri::AppHandle) -> Result<(), String> {
    let mut windows = state.windows.lock().map_err(|_| "Mutex Poisoned")?;

    let win = windows.get_mut(&payload.id)
        .ok_or("Window not found")?;

    if payload.container_w <= 0.0 || payload.container_h <= 0.0 {
        return Ok(());
    }

    // Convert fractions → pixels, swap, convert back
    let w_px = win.w * payload.container_w;
    let h_px = win.h * payload.container_h;
    win.w = h_px / payload.container_w;
    win.h = w_px / payload.container_h;

    let (mw_px, mh_px) = min_sizes_for(&payload.id);
    let min_w = mw_px / payload.container_w;
    let min_h = mh_px / payload.container_h;
    let max_w = (1.0 - win.x - MARGIN_FRAC).max(min_w);
    let max_h = (1.0 - win.y - MARGIN_FRAC).max(min_h);
    win.w = win.w.clamp(min_w, max_w);
    win.h = win.h.clamp(min_h, max_h);

    sync_and_save(app, &windows);
    Ok(())
}

// --- DSP RUNTIME SEAL ---

#[tauri::command]
fn get_dsp_token() -> u32 {
    let mut h = crc32fast::Hasher::new();
    h.update(b"v0id-rt-seal");
    h.update(&0x564F_4944u32.to_le_bytes());
    h.update(&0x5253_4543u32.to_le_bytes());
    h.finalize()
}

#[tauri::command]
async fn call_signaling(client: tauri::State<'_, reqwest::Client>, url: String) -> Result<String, String> {
    let res = if url.starts_with("http://") {
        reqwest::Client::new().get(&url).send().await
    } else {
        client.get(&url).send().await
    };
    res.map_err(|e| e.to_string())?.text().await.map_err(|e| e.to_string())
}

// --- HTTP PROXY (pinned TLS) ---

#[derive(Deserialize)]
struct ProxyRequest {
    method: String,
    url: String,
    headers: HashMap<String, String>,
    #[serde(default)]
    body: Option<Vec<u8>>,
}

#[derive(Serialize)]
struct ProxyResponse {
    status: u16,
    body: Vec<u8>,
}

/// Generic HTTP proxy routing requests through the cert-pinned reqwest client.
/// Allows the webview frontend to reach the self-signed signaling server.
#[tauri::command]
async fn http_fetch(
    client: tauri::State<'_, reqwest::Client>,
    request: ProxyRequest,
) -> Result<ProxyResponse, String> {
    let method: reqwest::Method = request.method.parse()
        .map_err(|_| format!("Invalid HTTP method: {}", request.method))?;

    let mut builder = if request.url.starts_with("http://") {
        reqwest::Client::new().request(method, &request.url)
    } else {
        client.request(method, &request.url)
    };

    for (k, v) in &request.headers {
        builder = builder.header(k.as_str(), v.as_str());
    }
    if let Some(body) = request.body {
        builder = builder.body(body);
    }

    let res = builder.send().await.map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let body = res.bytes().await.map_err(|e| e.to_string())?;

    Ok(ProxyResponse { status, body: body.to_vec() })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let crypto = Arc::new(rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(MyVerifier))
        .with_no_client_auth());

    let client = reqwest::Client::builder()
        .use_preconfigured_tls((*crypto).clone())
        .build()
        .expect("Failed to build reqwest client");

    let ws_connector = tokio_tungstenite::Connector::Rustls(crypto.clone());

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_websocket::Builder::new().tls_connector(ws_connector).build())
        .manage(client)
        .manage(LayoutState::default())
        .invoke_handler(tauri::generate_handler![
            call_signaling,
            http_fetch,
            get_dsp_token,
            identity::create_identity,
            identity::find_identity_by_pubkey,
            identity::update_identity_pseudo,
            identity::update_identity_avatar,
            identity::recover_identity,
            identity::sign_message,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // Set custom window icon for Windows taskbar
            if let Some(window) = app.get_webview_window("main") {
                let icon = tauri::include_image!("icons/icon.png");
                let _ = window.set_icon(icon);
            }

            // Load identity cache (handles legacy migration internally)
            let identity_cache = identity::init_cache(&handle);
            app.manage(identity_cache);


            // Load layout from disk, discard legacy pixel-based layouts
            let initial = load_layout_from_disk(&handle)
                .filter(|l| !is_legacy_pixel_layout(l))
                .unwrap_or_else(default_layout);
            if let Ok(mut windows) = handle.state::<LayoutState>().windows.lock() {
                *windows = initial;
                let batch = LayoutBatch { windows: windows.values().cloned().collect() };
                let _ = handle.emit("bento:layout:update", batch);
            }

            // Listeners avec gestion propre de l'état
            let h_move = handle.clone();
            app.listen_any("bento:layout:move", move |event| {
                if let Ok(p) = serde_json::from_str::<MovePayload>(event.payload()) {
                    let state = h_move.state::<LayoutState>();
                    let _ = handle_move(&state, p, &h_move);
                }
            });

            let h_resize = handle.clone();
            app.listen_any("bento:layout:resize", move |event| {
                if let Ok(p) = serde_json::from_str::<ResizePayload>(event.payload()) {
                    let state = h_resize.state::<LayoutState>();
                    let _ = handle_resize(&state, p, &h_resize);
                }
            });

            let h_swap = handle.clone();
            app.listen_any("bento:layout:swap", move |event| {
                if let Ok(p) = serde_json::from_str::<SwapPayload>(event.payload()) {
                    let state = h_swap.state::<LayoutState>();
                    let _ = handle_swap(&state, p, &h_swap);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    // ──────────────────── min_sizes_for ──────────────────────

    #[test]
    fn min_sizes_for_compact_bars() {
        assert_eq!(min_sizes_for("friends-bar"), (48.0, 48.0));
        assert_eq!(min_sizes_for("server-bar"), (48.0, 48.0));
    }

    #[test]
    fn min_sizes_for_default_panels() {
        assert_eq!(min_sizes_for("sidebar"), (MIN_W_PX, MIN_H_PX));
        assert_eq!(min_sizes_for("channel-panel"), (MIN_W_PX, MIN_H_PX));
        assert_eq!(min_sizes_for("unknown-widget"), (MIN_W_PX, MIN_H_PX));
    }

    // ──────────────────── default_layout ─────────────────────

    #[test]
    fn default_layout_contains_all_panels() {
        let layout = default_layout();
        let expected = ["sidebar", "channel-panel", "chat-panel", "friends-bar", "server-bar"];
        for id in &expected {
            assert!(layout.contains_key(*id), "missing panel: {id}");
        }
        assert_eq!(layout.len(), expected.len());
    }

    #[test]
    fn default_layout_fractions_in_range() {
        for (_, w) in default_layout() {
            assert!(w.x >= 0.0 && w.x <= 1.0, "{}: x={}", w.id, w.x);
            assert!(w.y >= 0.0 && w.y <= 1.0, "{}: y={}", w.id, w.y);
            assert!(w.w > 0.0 && w.w <= 1.0, "{}: w={}", w.id, w.w);
            assert!(w.h > 0.0 && w.h <= 1.0, "{}: h={}", w.id, w.h);
        }
    }

    #[test]
    fn default_layout_ids_match_keys() {
        for (key, w) in default_layout() {
            assert_eq!(key, w.id, "key/id mismatch for {key}");
        }
    }

    // ─────────────── is_legacy_pixel_layout ──────────────────

    #[test]
    fn legacy_detection_pixel_values() {
        let mut map = HashMap::new();
        map.insert("a".into(), LayoutWindow { id: "a".into(), x: 120.0, y: 80.0, w: 400.0, h: 300.0, z: 0 });
        assert!(is_legacy_pixel_layout(&map));
    }

    #[test]
    fn legacy_detection_fraction_values() {
        let mut map = HashMap::new();
        map.insert("a".into(), LayoutWindow { id: "a".into(), x: 0.1, y: 0.2, w: 0.5, h: 0.6, z: 0 });
        assert!(!is_legacy_pixel_layout(&map));
    }

    #[test]
    fn legacy_detection_boundary_value() {
        let mut map = HashMap::new();
        map.insert("a".into(), LayoutWindow { id: "a".into(), x: 2.0, y: 0.0, w: 0.5, h: 0.5, z: 0 });
        assert!(!is_legacy_pixel_layout(&map), "2.0 is the boundary, not legacy");
    }

    #[test]
    fn legacy_detection_just_above_boundary() {
        let mut map = HashMap::new();
        map.insert("a".into(), LayoutWindow { id: "a".into(), x: 2.01, y: 0.0, w: 0.5, h: 0.5, z: 0 });
        assert!(is_legacy_pixel_layout(&map));
    }

    #[test]
    fn legacy_detection_empty_map() {
        assert!(!is_legacy_pixel_layout(&HashMap::new()));
    }

    #[test]
    fn legacy_detection_mixed_panels() {
        let mut map = HashMap::new();
        map.insert("a".into(), LayoutWindow { id: "a".into(), x: 0.1, y: 0.2, w: 0.3, h: 0.4, z: 0 });
        map.insert("b".into(), LayoutWindow { id: "b".into(), x: 500.0, y: 0.0, w: 0.3, h: 0.4, z: 0 });
        assert!(is_legacy_pixel_layout(&map), "one pixel-based panel should flag the whole layout");
    }

    // ──────────────────── get_dsp_token ──────────────────────

    #[test]
    fn dsp_token_deterministic() {
        assert_eq!(get_dsp_token(), get_dsp_token());
    }

    #[test]
    fn dsp_token_nonzero() {
        assert_ne!(get_dsp_token(), 0);
    }

    // ──────────────────── LayoutBatch ────────────────────────

    #[test]
    fn layout_batch_serialization() {
        let batch = LayoutBatch {
            windows: vec![
                LayoutWindow { id: "a".into(), x: 0.0, y: 0.0, w: 0.5, h: 0.5, z: 1 },
            ],
        };
        let json = serde_json::to_string(&batch).unwrap();
        assert!(json.contains("\"windows\""));
        assert!(json.contains("\"a\""));
    }
}
