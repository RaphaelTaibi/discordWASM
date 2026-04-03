use std::sync::Arc;
use sha2::{Sha256, Digest};
use base64::{engine::general_purpose, Engine as _};
use rustls::pki_types::{CertificateDer, UnixTime, ServerName};
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::{DigitallySignedStruct, Error, SignatureScheme};

// --- CONFIGURATION PINNING ---
const PRIMARY_PIN: &str = env!("PRIMARY_PIN_HASH");
const BACKUP_PIN: &str = env!("BACKUP_PIN_HASH");

#[derive(Debug)]
struct MyVerifier;

impl ServerCertVerifier for MyVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &rustls::pki_types::CertificateDer<'_>,
        _intermediates: &[rustls::pki_types::CertificateDer<'_>],
        _server_name: &rustls::pki_types::ServerName<'_>,
        _ocsp_response: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> Result<ServerCertVerified, Error> {
        let mut hasher = Sha256::new();
        hasher.update(end_entity.as_ref());
        let hash = hasher.finalize();
        let hash_base64 = general_purpose::STANDARD.encode(hash);

        if hash_base64 == PRIMARY_PIN || hash_base64 == BACKUP_PIN {
            Ok(ServerCertVerified::assertion())
        } else {
            // Log pour debug en cas d'échec
            println!("Pinning failed. Received: {}", hash_base64);
            Err(Error::InvalidCertificate(rustls::CertificateError::UnknownIssuer))
        }
    }

    // --- CES 3 MÉTHODES SONT OBLIGATOIRES POUR RUSTLS 0.23 ---
    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        vec![
            SignatureScheme::RSA_PSS_SHA256,
            SignatureScheme::ECDSA_NISTP256_SHA256,
            SignatureScheme::ED25519,
        ]
    }
}

#[tauri::command]
async fn call_signaling(client: tauri::State<'_, reqwest::Client>) -> Result<String, String> {
    // Utilise l'URL de ton serveur Oracle (VITE_SIGNALING_URL)
    let res = client.get("https://89.168.59.45:3001/").send().await;
    match res {
        Ok(resp) => Ok(resp.text().await.map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Erreur TLS ou Réseau : {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {

    let _ = rustls::crypto::ring::default_provider().install_default();
    // Configuration TLS
    let crypto = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(MyVerifier))
        .with_no_client_auth();

    // Création du client HTTP avec la config TLS personnalisée
    let client = reqwest::Client::builder()
        .use_preconfigured_tls(crypto)
        .build()
        .expect("Failed to create secure client");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(client)
        .invoke_handler(tauri::generate_handler![call_signaling])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}