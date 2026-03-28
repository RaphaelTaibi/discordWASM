use wasm_bindgen::prelude::*;

// =========================
// === AUDIO ANALYSE & FX ===
// =========================

#[wasm_bindgen]
pub fn detect_peak(audio: &[f32], threshold: f32) -> bool {
    audio.iter().any(|&sample| sample.abs() > threshold)
}

#[wasm_bindgen]
pub fn rms_volume(audio: &[f32]) -> f32 {
    if audio.is_empty() {
        return 0.0;
    }
    let sum: f32 = audio.iter().map(|&x| x * x).sum();
    (sum / audio.len() as f32).sqrt()
}

#[wasm_bindgen]
pub fn detect_silence(audio: &[f32], threshold: f32) -> bool {
    audio.iter().all(|&sample| sample.abs() < threshold)
}

#[wasm_bindgen]
pub fn dominant_freq(audio: &[f32], sample_rate: f32) -> f32 {
    if audio.len() < 2 {
        return 0.0;
    }
    let mut max_corr = 0.0;
    let mut best_lag = 0;
    let max_lag = (sample_rate / 50.0) as usize;
    let min_lag = (sample_rate / 1000.0) as usize;
    for lag in min_lag..max_lag {
        let mut sum = 0.0;
        for i in 0..(audio.len() - lag) {
            sum += audio[i] * audio[i + lag];
        }
        if sum > max_corr {
            max_corr = sum;
            best_lag = lag;
        }
    }
    if best_lag == 0 {
        0.0
    } else {
        sample_rate / best_lag as f32
    }
}

#[wasm_bindgen]
pub fn compress_audio(audio: &[f32], threshold: f32, ratio: f32) -> Vec<f32> {
    let mut out = Vec::with_capacity(audio.len());
    for &sample in audio.iter() {
        let abs_sample = sample.abs();
        if abs_sample > threshold {
            let excess = abs_sample - threshold;
            let compressed = threshold + excess / ratio;
            out.push(sample.signum() * compressed);
        } else {
            out.push(sample);
        }
    }
    out
}

// Détection de clipping (saturation)
#[wasm_bindgen]
pub fn detect_clipping(audio: &[f32], clip_level: f32) -> bool {
    audio.iter().any(|&sample| sample.abs() >= clip_level)
}

// Mesure du crest factor (rapport pic/RMS)
#[wasm_bindgen]
pub fn crest_factor(audio: &[f32]) -> f32 {
    let peak = audio.iter().map(|x| x.abs()).fold(0.0, f32::max);
    let rms = rms_volume(audio);
    if rms == 0.0 { 0.0 } else { peak / rms }
}

// Normalisation d'un buffer audio (ramène le max à 1.0)
#[wasm_bindgen]
pub fn normalize_audio(audio: &[f32]) -> Vec<f32> {
    let max_val = audio.iter().map(|x| x.abs()).fold(0.0, f32::max);
    if max_val == 0.0 { return audio.to_vec(); }
    audio.iter().map(|&x| x / max_val).collect()
}

// Génération de bruit blanc (LCG, compatible WASM)
#[wasm_bindgen]
pub fn white_noise(len: usize, amplitude: f32, seed: u32) -> Vec<f32> {
    let mut out = Vec::with_capacity(len);
    let mut state = seed;
    for _ in 0..len {
        // LCG params : https://en.wikipedia.org/wiki/Linear_congruential_generator
        state = state.wrapping_mul(1664525).wrapping_add(1013904223);
        let val = ((state >> 8) & 0xFFFFFF) as f32 / 16777215.0 * 2.0 - 1.0;
        out.push(val * amplitude);
    }
    out
}

// =========================
// === VIDEO ANALYSE & FX ===
// =========================

#[wasm_bindgen]
pub fn analyze_frame(data: &[u8], width: u32, height: u32) -> String {
    let mut total: u64 = 0;
    for i in (0..data.len()).step_by(4) {
        total += data[i] as u64;
    }
    let avg = total / (width * height) as u64;
    format!("Frame {}x{} - Luminosité moyenne (R): {}", width, height, avg)
}

// Détection de frame noire
#[wasm_bindgen]
pub fn is_black_frame(data: &[u8], threshold: u8) -> bool {
    data.chunks(4).all(|px| px[0] < threshold && px[1] < threshold && px[2] < threshold)
}

// Détection de frame blanche
#[wasm_bindgen]
pub fn is_white_frame(data: &[u8], threshold: u8) -> bool {
    data.chunks(4).all(|px| px[0] > threshold && px[1] > threshold && px[2] > threshold)
}

// Calcul de l'histogramme des couleurs (R, G, B)
#[wasm_bindgen]
pub fn color_histogram(data: &[u8]) -> Vec<u32> {
    let mut hist_r = [0u32; 256];
    let mut hist_g = [0u32; 256];
    let mut hist_b = [0u32; 256];
    for px in data.chunks(4) {
        hist_r[px[0] as usize] += 1;
        hist_g[px[1] as usize] += 1;
        hist_b[px[2] as usize] += 1;
    }
    [hist_r.as_slice(), hist_g.as_slice(), hist_b.as_slice()].concat()
}

// Détection de freeze vidéo (frame identique sur plusieurs cycles)
#[wasm_bindgen]
pub fn is_frozen_frame(data1: &[u8], data2: &[u8], tolerance: u8) -> bool {
    if data1.len() != data2.len() { return false; }
    data1.iter().zip(data2.iter()).all(|(&a, &b)| (a as i16 - b as i16).abs() <= tolerance as i16)
}

// =========================
// === RÉSEAU & SÉCURITÉ ===
// =========================

// Conversion ms <-> samples
#[wasm_bindgen]
pub fn ms_to_samples(ms: f32, sample_rate: f32) -> usize {
    ((ms / 1000.0) * sample_rate) as usize
}

#[wasm_bindgen]
pub fn samples_to_ms(samples: usize, sample_rate: f32) -> f32 {
    (samples as f32 / sample_rate) * 1000.0
}

// Hachage rapide CRC32 d'un buffer
#[wasm_bindgen]
pub fn crc32_hash(data: &[u8]) -> u32 {
    use crc32fast::Hasher;
    let mut hasher = Hasher::new();
    hasher.update(data);
    hasher.finalize()
}

// =========================
// === AUTRES / UTILS    ===
// =========================

#[wasm_bindgen]
pub fn check_quality(bitrate: u32) -> String {
    if bitrate < 5000 {
        format!("Bitrate faible: {} kbps - Qualité SD", bitrate)
    } else {
        format!("Bitrate actuel: {} kbps - Analysé par Rust", bitrate)
    }
}

