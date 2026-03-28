# core-wasm

Ce package expose des fonctions Rust compilées en WebAssembly pour l'analyse et le traitement audio/vidéo, ainsi que des utilitaires réseau et sécurité.

## Présentation des fonctions exposées

Ce module WASM propose :

- **Analyse et effets audio**
  - `detect_peak` : Détecte si un échantillon audio dépasse un seuil donné (pic).
  - `rms_volume` : Calcule le volume RMS (Root Mean Square) d'un buffer audio.
  - `detect_silence` : Détecte si tout le buffer audio est sous un seuil (silence).
  - `dominant_freq` : Estime la fréquence dominante d'un signal audio par autocorrélation (pitch).
  - `compress_audio` : Applique une compression dynamique simple (limite les pics au-dessus d'un seuil).
  - `detect_clipping` : Détecte la saturation (clipping) dans le signal audio.
  - `crest_factor` : Calcule le rapport pic/RMS (crest factor), indicateur de dynamique.
  - `normalize_audio` : Normalise le buffer audio pour que le maximum soit à 1.0.
  - `white_noise` : Génère du bruit blanc pseudo-aléatoire (LCG, compatible WASM).

- **Analyse et effets vidéo**
  - `analyze_frame` : Calcule la luminosité moyenne (canal R) d'une image RGBA et retourne une chaîne descriptive.
  - `is_black_frame` : Détecte si une frame est noire (tous les pixels sous un seuil).
  - `is_white_frame` : Détecte si une frame est blanche (tous les pixels au-dessus d'un seuil).
  - `color_histogram` : Calcule l'histogramme des couleurs R, G, B d'une image.
  - `is_frozen_frame` : Détecte si deux frames sont identiques (ou très proches, tolérance donnée).

- **Réseau & sécurité**
  - `ms_to_samples` / `samples_to_ms` : Conversion entre millisecondes et nombre d'échantillons audio selon la fréquence d'échantillonnage.
  - `crc32_hash` : Calcule un hash CRC32 rapide d'un buffer (utile pour l'intégrité).

- **Autres / utilitaires**
  - `check_quality` : Retourne une chaîne de qualité selon le bitrate fourni.

Toutes les fonctions sont optimisées pour être appelées depuis JavaScript via WebAssembly. Les traitements audio/vidéo sont faits sur des buffers (`Float32Array` pour l'audio, `Uint8Array` pour la vidéo). Les fonctions de génération retournent des tableaux, les détections des booléens, les conversions/utilitaires des valeurs numériques ou chaînes.

## Exemples d'utilisation (JavaScript/TypeScript)

Ces exemples supposent que le module WASM a été compilé et importé côté JS/TS (ex: `import * as wasm from './core_wasm_bg.wasm'`).

### 1. Détection de pic audio
```js
const audio = Float32Array.from([0.1, 0.5, 0.9, 0.2]);
const hasPeak = wasm.detect_peak(audio, 0.8); // true
```

### 2. Calcul du volume RMS
```js
const rms = wasm.rms_volume(audio); // ex: 0.56
```

### 3. Détection de silence
```js
const silent = wasm.detect_silence(audio, 0.2); // false
```

### 4. Fréquence dominante
```js
const freq = wasm.dominant_freq(audio, 48000); // ex: 440.0
```

### 5. Compression audio
```js
const compressed = wasm.compress_audio(audio, 0.7, 4.0); // Float32Array compressé
```

### 6. Détection de clipping
```js
const clipped = wasm.detect_clipping(audio, 1.0); // false
```

### 7. Crest factor
```js
const crest = wasm.crest_factor(audio); // ex: 1.6
```

### 8. Normalisation
```js
const norm = wasm.normalize_audio(audio); // max(norm) == 1.0
```

### 9. Génération de bruit blanc
```js
const noise = wasm.white_noise(1024, 0.5, 1234); // 1024 échantillons bruités
```

### 10. Analyse d'une frame vidéo RGBA
```js
const frame = new Uint8Array([r,g,b,a, ...]);
const info = wasm.analyze_frame(frame, 1920, 1080); // "Frame 1920x1080 - Luminosité moyenne (R): ..."
```

### 11. Détection de frame noire/blanche
```js
const isBlack = wasm.is_black_frame(frame, 10); // true/false
const isWhite = wasm.is_white_frame(frame, 245); // true/false
```

### 12. Histogramme de couleurs
```js
const hist = wasm.color_histogram(frame); // Tableau de 256*3 valeurs
```

### 13. Détection de freeze vidéo
```js
const frozen = wasm.is_frozen_frame(frame1, frame2, 2); // true/false
```

### 14. Conversion ms <-> samples
```js
const samples = wasm.ms_to_samples(20, 48000); // 960
const ms = wasm.samples_to_ms(960, 48000); // 20.0
```

### 15. Hash CRC32
```js
const hash = wasm.crc32_hash(frame); // ex: 0xAABBCCDD
```

### 16. Vérification de qualité
```js
const quality = wasm.check_quality(8000); // "Bitrate actuel: 8000 kbps - Analysé par Rust"
```
