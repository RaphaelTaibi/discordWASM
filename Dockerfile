# Image de base légère (Debian Bookworm)
FROM debian:bookworm-slim

# Installation des dépendances minimales pour l'exécution (SSL/Certificats)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# On copie le binaire pré-compilé (GitHub Actions doit le mettre dans le même dossier)
COPY signaling-server /usr/local/bin/signaling-server
RUN chmod +x /usr/local/bin/signaling-server

# Ports : 3001 (Signaling) et plage UDP (Audio WebRTC)
EXPOSE 3001
EXPOSE 10000-10100/udp

# Lancement du serveur
CMD ["/usr/local/bin/signaling-server"]