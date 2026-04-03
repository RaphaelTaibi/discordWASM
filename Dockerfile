# 1. Utilise l'image officielle Rust
FROM rust:1.88-slim AS builder

# Installation des dépendances de compilation
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- SECTION SECRETS ---
# Récupère les hashs depuis les build-args de GitHub Actions
ARG PRIMARY_PIN_HASH
ARG BACKUP_PIN_HASH

# Injecte comme variables d'env pour que la macro env!() de Rust les trouve
ENV PRIMARY_PIN_HASH=${PRIMARY_PIN_HASH}
ENV BACKUP_PIN_HASH=${BACKUP_PIN_HASH}

# Copie les fichiers de structure
COPY Cargo.toml Cargo.lock ./
COPY packages/signaling-server packages/signaling-server

# Ruse pour les dummy crates (monorepo Cargo workspace)
RUN mkdir -p apps/desktop/src-tauri/src && \
    echo "fn main() {}" > apps/desktop/src-tauri/src/main.rs && \
    echo '[package]\nname = "desktop"\nversion = "0.1.0"\nedition = "2021"\n[lib]\nname = "desktop_lib"\ncrate-type = ["rlib"]\n[dependencies]\n' > apps/desktop/src-tauri/Cargo.toml && \
    echo "pub fn dummy() {}" > apps/desktop/src-tauri/src/lib.rs && \
    mkdir -p packages/core-wasm/src && \
    echo "pub fn dummy() {}" > packages/core-wasm/src/lib.rs && \
    echo '[package]\nname = "core-wasm"\nversion = "0.1.0"\nedition = "2021"\n[dependencies]\n' > packages/core-wasm/Cargo.toml

# Build en mode Release
RUN cargo build --release -p signaling-server

# 2. Image finale légère
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Récupère le binaire compilé qui contient maintenant les hashs
COPY --from=builder /app/target/release/signaling-server /usr/local/bin/signaling-server

# Ports : 3001 (Signaling) et plage UDP (Audio WebRTC)
EXPOSE 3001
EXPOSE 10000-10100/udp

# On lance le serveur
CMD ["/usr/local/bin/signaling-server"]