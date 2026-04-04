# 🎙️ Vocal-WASM-SFU - Signaling Server Backend

Serveur de signalisation WebRTC haute performance écrit en Rust pour des communications audio/vidéo en temps réel.

![Rust](https://img.shields.io/badge/Rust-1.70+-orange)
![WebRTC](https://img.shields.io/badge/WebRTC-SFU-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 📋 Table des Matières

- [Architecture](#architecture)
- [Fonctionnalités](#fonctionnalités)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Déploiement](#déploiement)
- [Monitoring](#monitoring)
- [API WebSocket](#api-websocket)
- [Sécurité](#sécurité)
- [Performance](#performance)

---

## 🏗️ Architecture

┌─────────────────────────────────────────────────────────────┐
│ VM Oracle Cloud (ARM) │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ Prometheus │ │ Grafana │ │Alertmanager │ │
│ │ :9090 │ │ :3000 │ │ :9093 │ │
│ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ │
│ │ │ │ │
│ └──────────────────┼──────────────────┘ │
│ │ │
│ ┌─────────────────────────┴─────────────────────────┐ │
│ │ Signaling Server Rust │ │
│ │ (axum-server) │ │
│ │ :3001/HTTPS │ │
│ │ :3001/metrics │ │
│ └─────────────────────────┬─────────────────────────┘ │
│ │ │
│ ┌─────────────────────────┴─────────────────────────┐ │
│ │ Node Exporter │ │
│ │ :9100 │ │
│ └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────┐
│ Client Tauri │
│ (.exe) │
│ Certificate │
│ Pinning │
└─────────────────┘


---

## ✨ Fonctionnalités

| Fonctionnalité | Description |
|----------------|-------------|
| **Signalisation WebRTC** | Échange d'offres/answers SDP et candidats ICE |
| **SFU (Selective Forwarding Unit)** | Routage intelligent des flux média entre pairs |
| **Salons Multiples** | Support de plusieurs salons avec isolation |
| **Chat en Temps Réel** | Messagerie texte intégrée |
| **État Média** | Mute/Deafen en temps réel |
| **Monitoring Prometheus** | Métriques exposées sur `/metrics` |
| **TLS Natif** | Chiffrement via axum-server (rustls) |
| **Certificate Pinning** | Sécurité renforcée avec empreinte cert |
| **Jitter Buffer** | Lissage des paquets RTP (30ms) |
| **Catch-up Optimisé** | Rejoindre un salon en cours |

---

## 📦 Prérequis

### Système

- **Architecture** : ARM64 (Aarch64) ou x86_64
- **OS** : Ubuntu 22.04 LTS ou supérieur
- **RAM** : Minimum 4GB (recommandé : 8GB+)
- **CPU** : 4 cœurs minimum

### Dépendances

```bash
# Installer Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Installer les dépendances système
sudo apt update && sudo apt install -y build-essential pkg-config libssl-dev

# Installer Docker (optionnel)
curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

# 🚀 Installation

## **1. Cloner le Repository**

```bash 
   git clone https://github.com/ton-utilisateur/discord-wasm-sfu.git
   cd discord-wasm-sfu/packages/signaling-server
```

## **2. Générer les Certificats TLS**

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem \
  -sha256 -days 365 -nodes -subj \
  "/C=FR/ST=PACA/L=LaGarde/O=VocalWASM/CN=_ip_publique"
```
## **3. Compiler le Binaire**
```bash
# Mode développement
cargo build

# Mode production (optimisé)
cargo build --release

# Pour ARM64 (Oracle Cloud)
cargo build --release --target aarch64-unknown-linux-gnu
```
## **4. Lancer le Serveur**
```bash
# Mode développement
cargo run

# Mode production
./target/release/signaling-server
```

## **⚙️ Configuration**

Variables d'Environnement
```bash
# Fichier .env
RUST_LOG=info  # Niveau de log (debug, info, warn, error)
```
| Port | Protocole | Description |
|------|-----------|-------------|
| 3001 | TCP | HTTPS/WSS (Signalisation) |
| 10000-20000 | UDP | Flux WebRTC (RTP/RTCP) |

**Configuration Firewall**
```bash
# Ouvrir les ports sur la VM
sudo iptables -I INPUT 1 -p tcp --dport 3001 -j ACCEPT
sudo iptables -I INPUT 1 -p udp --dport 10000:20000 -j ACCEPT
sudo netfilter-persistent save
```
**Oracle Cloud VCN**

Ajouter les règles d'entrée (Ingress Rules) :

| Protocol | Port Range | Source |
|----------|------------|--------|
| TCP | 3001 | 0.0.0.0/0 |
| UDP | 10000-20000 | 0.0.0.0/0 |

**🐳 Déploiement Docker**

docker-compose.yml
```yaml
version: '3.8'

services:
  signaling-server:
    build: .
    ports:
      - "3001:3001"
      - "10000-20000:10000-20000/udp"
    volumes:
      - ./cert.pem:/cert.pem:ro
      - ./key.pem:/key.pem:ro
    environment:
      - RUST_LOG=info
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./docker/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    networks:
      - sfu-network
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=Mirage2000
    volumes:
      - grafana_data:/var/lib/grafana
      - ./docker/grafana/provisioning:/etc/grafana/provisioning:ro
    networks:
      - sfu-network
    restart: unless-stopped

  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./docker/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
    networks:
      - sfu-network
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
    networks:
      - sfu-network
    restart: unless-stopped

networks:
  sfu-network:
    driver: bridge

volumes:
  prometheus_data:
  grafana_data:
```
**Lancer avec Docker**
```bash# Build et démarrage
docker compose up -d --build

# Voir les logs
docker compose logs -f signaling-server

# Arrêter les services
docker compose down
```
**📊 Monitoring**

Métriques Exposées

| Métrique | Type | Description |
|----------|------|-------------|
| `sfu_active_peers` | Gauge | Nombre de pairs connectés |
| `sfu_active_channels` | Gauge | Nombre de salons actifs |
| `sfu_bandwidth_egress_bps` | Gauge | Bande passante sortante (bits/s) |
| `sfu_bandwidth_ingress_bps` | Gauge | Bande passante entrante (bits/s) |
| `sfu_packets_per_second` | Histogram | Paquets RTP par seconde |

**Vérifier les Métriques**
```bash
# Endpoint metrics
curl http://localhost:3001/metrics

# Endpoint health
curl http://localhost:3001/health
```
**Prometheus Configuration**
```yaml
# docker/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'signaling-server'
    static_configs:
      - targets: ['89.168.59.45:3001']
    metrics_path: /metrics
    scrape_interval: 5s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['89.168.59.45:9100']

  - job_name: 'alertmanager'
    static_configs:
      - targets: ['localhost:9093']
```
**Dashboard Grafana**
Importer le dashboard pour visualiser :

* Pairs connectés en temps réel
* Bande passante (ingress/egress)
* Paquets RTP par seconde
* Nombre de salons actifs

# **🔌 API WebSocket**

## **Connection**

```typescript
const ws = new WebSocket('wss://89.168.59.45:3001/ws');

ws.onopen = () => {
  console.log('Connected to signaling server');
};
```

**## Messages Client → Serveur**

**Join Salon**
```json
{
"type": "join",
"channelId": "room-123",
"userId": "user-abc",
"username": "Alice"
}
```
**SDP**
```json
{
  "type": "offer",
  "sdp": {
    "type": "offer",
    "sdp": "v=0\r\no=- 0 0 IN IP4 0.0.0.0\r\n..."
  }
}
```


**Candidat ICE**
```json
{
  "type": "ice",
  "candidate": {
    "candidate": "candidate:...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

**Chat**
```json
{
  "type": "chat",
  "channelId": "room-123",
  "from": "user-abc",
  "username": "Alice",
  "message": "Hello!",
  "timestamp": 1700000000000
}
```

## **Messages Serveur → Client**

**Joined**
```json
{
  "type": "joined",
  "channelId": "room-123",
  "peers": [
    {
      "userId": "user-xyz",
      "username": "Bob",
      "isMuted": false,
      "isDeafened": false
    }
  ],
  "startedAt": 1700000000000
}
```
**Track Map**
```json
{
  "type": "trackMap",
  "userId": "user-xyz",
  "trackId": "track-123",
  "streamId": "stream-456",
  "kind": "video"
}
```
**Stats**
```json
{
  "type": "stats",
  "userId": "user-abc",
  "bandwidthBps": 1250000
}
```

# **🔒 Sécurité**

## **TLS Natif**

Le serveur utilise axum-server avec rustls pour le chiffrement TLS :
```rust
let config = RustlsConfig::from_pem_file(
    PathBuf::from("cert.pem"),
    PathBuf::from("key.pem")
).await?;

axum_server::bind_rustls(addr, config)
    .serve(app.into_make_service())
    .await?;
```
## **Certificate Pinning**
Le client Tauri intègre l'empreinte SHA-256 du certificat :
```rust
// Dans le client Tauri
let expected_hash = "expected_certificate_hash_here";
let cert_hash = compute_cert_hash(&server_cert);

if cert_hash != expected_hash {
    return Err("Certificate mismatch - possible MITM attack");
}
```

# **Modèle OSI**

| Couche | Protection |
|--------|------------|
| **Transport** | Chiffrement TLS (AES-256) via axum-server |
| **Réseau** | Isolation VCN Oracle + iptables |
| **Application** | Memory Safety (Rust) - Pas de buffer overflow |

# **Sécurité WebRTC**

| Flux | Chiffrement |
|------|-------------|
| Signaling (WSS) | TLS 1.3 |
| Média (Audio/Video) | DTLS/SRTP |
| Données (DataChannel) | DTLS/SRTP |

# **⚡ Performance**
## **Benchmarks (VM Oracle ARM Ampere plan Always Free)**

| Métrique | Valeur |
|----------|--------|
| **Architecture** | ARM64 (4 cœurs) |
| **RAM** | 24 GB |
| **Bande Passante** | 1 Gbps |
| **Latence Signalisation** | < 10ms |
| **Pairs Maximaux** | 100+ par salon |
| **Codec Audio** | Opus (48kHz) |
| **Codec Vidéo** | VP8/VP9/H.264 |

## **Optimisations**

* **Jitter Buffer :** 30ms pour lisser les paquets RTP
* **Forwarding Asynchrone :** Utilisation de tokio::spawn pour le forwarding
* **Catch-up Optimisé :** Un seul offer SDP pour tous les tracks existants
* **Memory Safety :** Rust élimine les erreurs de gestion mémoire

# **🐛 Dépannage**

## **Problème : Certificats non trouvés**

```bash
# Vérifier que les certificats sont à la racine
ls -la cert.pem key.pem

# Permissions correctes
chmod 600 key.pem
chmod 644 cert.pem
```
## **Problème : Ports bloqués**

```bash
# Trouver le processus
sudo lsof -i :3001

# Tuer le processus
sudo kill -9 <PID>

# Ou arrêter Docker
docker compose down
```
## **Problème : Métriques non exposées**

```bash
# Vérifier que l'endpoint fonctionne
curl http://localhost:3001/metrics

# Vérifier les logs Prometheus
docker logs prometheus | grep "signaling-server"
```
## **Problème : Connexion refusée**
```bash
# Vérifier les règles firewall
sudo iptables -L -n -v

# Vérifier les logs
docker compose logs signaling-server
```

# _📚 Ressources_

* [Documentation axum-server](https://docs.rs/axum-server/latest/axum_server/)
* [Documentation rustls](https://docs.rs/rustls/latest/rustls/)
* [WebRTC SFU Best Practices](https://webrtc.org/best-practices/sfu/)
* [Prometheus Metrics](https://prometheus.io/docs/concepts/metric_types/)
* [Grafana Dashboards](https://grafana.com/grafana/dashboards)
* [Oracle Cloud VCN](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/overview.htm)

# **📝 Licence**

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

