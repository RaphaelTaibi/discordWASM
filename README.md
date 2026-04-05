# Vocal WASM

Welcome to Vocal WASM, a cross-platform voice and signaling client inspired by Discord. This project leverages Tauri, Web, WASM, Rust, and TypeScript to deliver high-performance, real-time audio communication for desktop and web platforms.

## Features

- **Cross-platform**: Desktop (Tauri), Web, and WASM support
- **High-performance audio**: Rust core compiled to WebAssembly for fast digital signal processing (DSP)
- **Modern UI**: Built with React and Vite
- **Real-time signaling**: WebRTC signaling server in Rust
- **Modular architecture**: Easily extend or embed in other projects
- **Audio worklet integration**: Custom audio processing with WASM-powered worklets

## Project Structure

- `apps/desktop/`: Desktop app (Tauri + React + Vite)
- `packages/core-wasm/`: Audio/video core in Rust compiled to WebAssembly
- `packages/signaling-server/`: WebRTC signaling server (Rust)

## Main Scripts

Run from the root or the relevant folder:

- `pnpm install`: Install dependencies
- `pnpm dev`: Start the desktop app in development mode
- `pnpm build`: Build the desktop app
- `pnpm build:worklet`: Build the audio worklet (generates JS in `public/worker/`)
- `pnpm tauri build`: Native desktop build (Tauri)

## Quick Start

```sh
pnpm install
cd apps/desktop
pnpm dev
```

## Audio Worklet Troubleshooting

- The file `noise-gate.worklet.js` must be generated in `apps/desktop/public/worker/`.
- The path used in the code must be `/worker/noise-gate.worklet.js`.
- If you see "Unable to load a worklet's module", check the file presence and path.

## Download

Releases and install instructions will be available on the [Releases page](https://github.com/RaphaelTaibi/discordWASM/releases).

## Changelog

See the [Changelog](./CHANGELOG.md) for version history.

## Disclaimer
**This project is an independent, open-source educational proof-of-concept. It is not affiliated with,
endorsed by, or associated with Discord Inc. The UI design is intended as a study of modern
communication interface patterns.**

## License
MIT

For 3rd-party licences, see LICENSE. The licensing information is considered to be part of the documentation.

---

# Vocal WASM (FR)

Bienvenue sur Vocal WASM, un client vocal et de signalisation multiplateforme inspiré de Discord. Ce projet s’appuie sur Tauri, Web, WASM, Rust et TypeScript pour offrir une communication audio temps réel performante sur desktop et web.

## Fonctionnalités

- **Multiplateforme** : Desktop (Tauri), Web et WASM
- **Audio haute performance** : Noyau Rust compilé en WebAssembly pour un traitement DSP rapide
- **UI moderne** : Conçue avec React et Vite
- **Signalisation temps réel** : Serveur WebRTC en Rust
- **Architecture modulaire** : Extensible et intégrable facilement
- **Intégration audio worklet** : Traitement audio personnalisé avec worklets propulsés par WASM

## Structure du projet

- `apps/desktop/` : Application desktop (Tauri + React + Vite)
- `packages/core-wasm/` : Noyau audio/vidéo en Rust compilé en WebAssembly
- `packages/signaling-server/` : Serveur de signalisation WebRTC (Rust)

## Scripts principaux

À lancer depuis la racine ou le dossier concerné :

- `pnpm install` : Installation des dépendances
- `pnpm dev` : Lancer l’app desktop en mode développement
- `pnpm build` : Build de l’app desktop
- `pnpm build:worklet` : Build du worklet audio (génère le JS dans `public/worker/`)
- `pnpm tauri build` : Build desktop natif (Tauri)

## Démarrage rapide

```sh
pnpm install
cd apps/desktop
pnpm dev
```

## Dépannage worklet audio

- Le fichier `noise-gate.worklet.js` doit être généré dans `apps/desktop/public/worker/`.
- Le chemin utilisé dans le code doit être `/worker/noise-gate.worklet.js`.
- Si erreur "Unable to load a worklet's module", vérifier la présence du fichier et le chemin.

## Téléchargement

Les releases et instructions d’installation seront disponibles sur la [page Releases](https://github.com/RaphaelTaibi/discordWASM/releases).

## Changelog

Voir le [Changelog](./CHANGELOG.md) pour l’historique des versions.


## Disclaimer
**Ce logiciel est une preuve de concept technique. L'interface utilisateur est inspirée par les standards modernes de communication. Vocal WASM n'est pas affilié à Discord Inc.**

## Licence
MIT

Pour les licences tierces, voir LICENSE. Les informations de licence font partie de la documentation.
