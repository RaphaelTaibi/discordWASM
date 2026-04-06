mod identity;

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

// --- BENTO LAYOUT ENGINE ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutWindow {
    pub id: String,
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    pub z: i32,
}

#[derive(Default)]
pub struct LayoutState {
    pub windows: Mutex<HashMap<String, LayoutWindow>>,
    pub margin: Mutex<i32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MovePayload {
    pub id: String,
    pub dx: i32,
    pub dy: i32,
    pub container_w: i32,
    pub container_h: i32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ResizePayload {
    pub id: String,
    pub dw: i32,
    pub dh: i32,
    pub container_w: i32,
    pub container_h: i32,
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

/// Provides sensible default panel positions when no persisted layout exists.
fn default_layout() -> HashMap<String, LayoutWindow> {
    let mut map = HashMap::new();
    map.insert("sidebar".into(), LayoutWindow { id: "sidebar".into(), x: 8, y: 48, w: 260, h: 600, z: 20 });
    map.insert("channel-panel".into(), LayoutWindow { id: "channel-panel".into(), x: 280, y: 48, w: 500, h: 600, z: 10 });
    map.insert("chat-panel".into(), LayoutWindow { id: "chat-panel".into(), x: 280, y: 48, w: 500, h: 600, z: 30 });
    map
}

// --- HANDLERS ---

pub fn handle_move(state: &LayoutState, payload: MovePayload, app: &tauri::AppHandle) -> Result<(), String> {
    let mut windows = state.windows.lock().map_err(|_| "Mutex Poisoned")?;
    let margin = *state.margin.lock().map_err(|_| "Mutex Poisoned")?;

    let win = windows.entry(payload.id.clone()).or_insert(LayoutWindow {
        id: payload.id.clone(), x: 100, y: 100, w: 240, h: 500, z: 0,
    });

    win.x += payload.dx;
    win.y += payload.dy;

    // Bornes calculées dynamiquement selon le conteneur JS
    let max_x = payload.container_w - win.w - margin;
    let max_y = payload.container_h - win.h - margin;

    win.x = win.x.clamp(margin, max_x.max(margin));
    win.y = win.y.clamp(margin, max_y.max(margin));

    sync_and_save(app, &windows);
    Ok(())
}

pub fn handle_resize(state: &LayoutState, payload: ResizePayload, app: &tauri::AppHandle) -> Result<(), String> {
    let mut windows = state.windows.lock().map_err(|_| "Mutex Poisoned")?;
    let margin = *state.margin.lock().map_err(|_| "Mutex Poisoned")?;

    let win = windows.entry(payload.id.clone()).or_insert(LayoutWindow {
        id: payload.id.clone(), x: 100, y: 100, w: 240, h: 500, z: 0,
    });

    win.w = (win.w + payload.dw).max(150);
    win.h = (win.h + payload.dh).max(100);

    let max_w = payload.container_w - win.x - margin;
    let max_h = payload.container_h - win.y - margin;

    win.w = win.w.clamp(150, max_w.max(150));
    win.h = win.h.clamp(100, max_h.max(100));

    sync_and_save(app, &windows);
    Ok(())
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
            identity::create_identity,
            identity::find_identity_by_pubkey,
            identity::update_identity_pseudo,
            identity::update_identity_avatar,
            identity::recover_identity,
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

            // Initialisation du layout depuis le disque (ou valeurs par défaut)
            let initial = load_layout_from_disk(&handle).unwrap_or_else(default_layout);
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

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}