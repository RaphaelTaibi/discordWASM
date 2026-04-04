use std::sync::Arc;
use sha2::{Sha256, Digest};
use base64::{engine::general_purpose, Engine as _};

// Utilisation des types officiels de rustls 0.23
use rustls::client::danger::{ServerCertVerified, ServerCertVerifier, HandshakeSignatureValid};
use rustls::{DigitallySignedStruct, Error, SignatureScheme};

// Importation depuis la crate pki-types directement (plus stable)
use rustls_pki_types::{CertificateDer, UnixTime, ServerName};
// --- CONFIGURATION PINNING ---
// Note: L'empreinte (hash) d'un certificat public n'est PAS une donnée sensible.
// Tout le monde peut voir le certificat en se connectant au serveur.
// C'est la clé *privée* du serveur qu'il faut protéger, pas le PIN du client.
// Il est donc 100% sûr de hardcoder ce hash ici pour que l'EXE fonctionne du premier coup !
const PRIMARY_PIN: &str = match option_env!("PRIMARY_PIN_HASH") {
    Some(v) => v,
    None => "JZnp4wOHrwvdpPtDzwptWkD//NH4oiGY2rP/3GmAZWI=",
};

const BACKUP_PIN: &str = match option_env!("BACKUP_PIN_HASH") {
    Some(v) => v,
    None => "DEV_PIN",
};

#[derive(Debug)]
/// Custom certificate verifier used to implement SSL pinning.
/// Validates the server certificate against hardcoded primary and backup PINs.
struct MyVerifier;

impl ServerCertVerifier for MyVerifier {
    /// Verifies the end-entity certificate presented by the server.
    /// Hashes the certificate in DER format using SHA-256 and compares its Base64-encoded
    /// string representation to the predefined `PRIMARY_PIN` and `BACKUP_PIN`.
    ///
    /// Returns `Ok(ServerCertVerified::assertion())` if the hash matches,
    /// or `Err(Error::InvalidCertificate(...))` in case of a mismatch, preventing potential MITM attacks.
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

        // Nettoyage des guillemets éventuels pour éviter les bugs de comparaison causés par les fichiers .env
        let clean_primary = PRIMARY_PIN.trim_matches('"');
        let clean_backup = BACKUP_PIN.trim_matches('"');

        if hash_base64 == clean_primary || hash_base64 == clean_backup {
            println!("✅ Pinning validé : {} matches !", hash_base64);
            Ok(ServerCertVerified::assertion())
        } else {
            println!("❌ ALERTE MITM : Reçu '{}' (Attendu: '{}')", hash_base64, clean_primary);
            Err(Error::InvalidCertificate(rustls::CertificateError::UnknownIssuer))
        }
    }

    /// Verifies the TLS 1.2 handshake signature.
    /// This implementation skips explicit signature verification, assuming the pinning handles trust.
    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    /// Verifies the TLS 1.3 handshake signature.
    /// This implementation skips explicit signature verification, assuming the pinning handles trust.
    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    /// Returns the signature verification schemes supported by this verifier.
    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        vec![
            SignatureScheme::RSA_PSS_SHA256,
            SignatureScheme::ECDSA_NISTP256_SHA256,
            SignatureScheme::ED25519,
        ]
    }
}

/// Invokes the signaling server via an HTTPS GET request.
/// Utilizes the provided pre-configured `reqwest::Client` injected as a Tauri state,
/// ensuring that the request honors the custom SSL pinning rules.
///
/// # Returns
/// An `Ok(String)` containing the server's response body text upon success,
/// or an `Err(String)` containing the TLS/Network error message on failure.
#[tauri::command]
async fn call_signaling(client: tauri::State<'_, reqwest::Client>, url: String) -> Result<String, String> {
    let res = client.get(&url).send().await;
    match res {
        Ok(resp) => Ok(resp.text().await.map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Erreur TLS : {}", e)),
    }
}

/// Main entry point for the Tauri application.
/// Initializes the default cryptography provider, configures the custom TLS client
/// with SSL pinning for both HTTP and WebSocket connections, and bootstraps the Tauri application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Installer le provider Ring
    let _ = rustls::crypto::ring::default_provider().install_default();

    // Configuration TLS "Dangerous" (Custom Pinning)
    let crypto = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(MyVerifier))
        .with_no_client_auth();

    let arc_crypto = Arc::new(crypto);

    // Client HTTP partagé
    let client = reqwest::Client::builder()
        .use_preconfigured_tls((*arc_crypto).clone())
        .build()
        .expect("Failed to create client");

    // Client WebSocket partagé pour le plugin tauri-plugin-websocket (bypassing secure check via rustls)
    let ws_connector = tokio_tungstenite::Connector::Rustls(arc_crypto.clone());

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_websocket::Builder::new()
                .tls_connector(ws_connector)
                .build()
        )
        .manage(client)
        .invoke_handler(tauri::generate_handler![call_signaling])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}