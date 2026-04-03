# Utilise l'image officielle Rust
FROM rust:1.86-slim AS builder

# Installation des dépendances de compilation (essentiel pour WebRTC/OpenSSL)
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# On copie les fichiers de lock pour le cache
COPY Cargo.toml Cargo.lock ./
COPY packages/signaling-server packages/signaling-server

# Ruse pour les dummy crates (indispensable en monorepo/Cargo workspace)
RUN mkdir -p apps/desktop/src-tauri/src && \
    echo "fn main() {}" > apps/desktop/src-tauri/src/main.rs && \
    echo '[package]\nname = "desktop"\nversion = "0.1.0"\nedition = "2021"\n[lib]\nname = "desktop_lib"\ncrate-type = ["rlib"]\n[dependencies]\n' > apps/desktop/src-tauri/Cargo.toml && \
    echo "pub fn dummy() {}" > apps/desktop/src-tauri/src/lib.rs && \
    mkdir -p packages/core-wasm/src && \
    echo "pub fn dummy() {}" > packages/core-wasm/src/lib.rs && \
    echo '[package]\nname = "core-wasm"\nversion = "0.1.0"\nedition = "2021"\n[dependencies]\n' > packages/core-wasm/Cargo.toml

# Build en mode Release pour l'architecture ARM native (Passage de render en hébergeur a un VM ARM64 Oracle Cloud)
RUN cargo build --release -p signaling-server

# Image finale légère
FROM debian:bookworm-slim
# Ajout de OpenSSL et CA-Certificates (obligatoire pour les WebSockets sécurisés)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/signaling-server /usr/local/bin/signaling-server

# Acces au certificat auto-signé
COPY packages/signaling-server/cert.pem .
COPY packages/signaling-server/key.pem .

# Ports : 3001 pour le Signaling (TCP) et on prépare une plage pour l'audio (UDP)
EXPOSE 3001
EXPOSE 10000-10100/udp

CMD ["signaling-server"]
