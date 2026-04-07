use wasm_bindgen::prelude::*;

pub mod proto;
pub mod codec;

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

#[wasm_bindgen]
pub fn detect_clipping(audio: &[f32], clip_level: f32) -> bool {
    audio.iter().any(|&sample| sample.abs() >= clip_level)
}

#[wasm_bindgen]
pub fn crest_factor(audio: &[f32]) -> f32 {
    let peak = audio.iter().map(|x| x.abs()).fold(0.0, f32::max);
    let rms = rms_volume(audio);
    if rms == 0.0 { 0.0 } else { peak / rms }
}

#[wasm_bindgen]
pub fn normalize_audio(audio: &[f32]) -> Vec<f32> {
    let max_val = audio.iter().map(|x| x.abs()).fold(0.0, f32::max);
    if max_val == 0.0 { return audio.to_vec(); }
    audio.iter().map(|&x| x / max_val).collect()
}

#[wasm_bindgen]
pub fn white_noise(len: usize, amplitude: f32, seed: u32) -> Vec<f32> {
    let mut out = Vec::with_capacity(len);
    let mut state = seed;
    for _ in 0..len {
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

#[wasm_bindgen]
pub fn is_black_frame(data: &[u8], threshold: u8) -> bool {
    data.chunks(4).all(|px| px[0] < threshold && px[1] < threshold && px[2] < threshold)
}

#[wasm_bindgen]
pub fn is_white_frame(data: &[u8], threshold: u8) -> bool {
    data.chunks(4).all(|px| px[0] > threshold && px[1] > threshold && px[2] > threshold)
}

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

#[wasm_bindgen]
pub fn is_frozen_frame(data1: &[u8], data2: &[u8], tolerance: u8) -> bool {
    if data1.len() != data2.len() { return false; }
    data1.iter().zip(data2.iter()).all(|(&a, &b)| (a as i16 - b as i16).abs() <= tolerance as i16)
}

// =========================
// === RÉSEAU & SÉCURITÉ ===
// =========================

// Calcule un score de qualité réseau (0-3) bas sur WebRTC stats
#[wasm_bindgen]
pub fn calculate_network_quality(latency_ms: f32, packet_loss: f32, jitter_ms: f32) -> u8 {
    // 3: Excellent, 2: Moyen, 1: Mauvais, 0: Critique/Dconnect
    if latency_ms > 400.0 || packet_loss > 0.15 || jitter_ms > 100.0 {
        return 1;
    }
    if latency_ms > 150.0 || packet_loss > 0.05 || jitter_ms > 30.0 {
        return 2;
    }
    3
}

#[wasm_bindgen]
pub fn process_network_stats(
    total_rtt: f32,
    count: f32,
    candidate_pair_rtt: f32,
    fallback_rtt: f32,
    total_loss: f32,
    total_jitter: f32,
) -> Vec<f32> {
    let mut final_rtt = 0.0;

    if count > 0.0 {
        final_rtt = total_rtt / count;
    } else if candidate_pair_rtt > 0.0 {
        final_rtt = candidate_pair_rtt;
    } else if fallback_rtt > 0.0 {
        final_rtt = fallback_rtt;
    }

    let final_loss = if count > 0.0 {
        total_loss / count
    } else {
        0.0
    };

    let final_jitter = if count > 0.0 {
        total_jitter / count
    } else {
        0.0
    };

    let final_ping = final_rtt.max(1.0).round();
    let packet_loss_pct = final_loss * 100.0;
    let quality = calculate_network_quality(final_rtt, final_loss, final_jitter) as f32;

    vec![final_ping, packet_loss_pct, final_jitter, quality, final_rtt]
}

#[wasm_bindgen]
pub fn ms_to_samples(ms: f32, sample_rate: f32) -> usize {
    ((ms / 1000.0) * sample_rate) as usize
}

#[wasm_bindgen]
pub fn samples_to_ms(samples: usize, sample_rate: f32) -> f32 {
    (samples as f32 / sample_rate) * 1000.0
}

#[wasm_bindgen]
pub fn crc32_hash(data: &[u8]) -> u32 {
    use crc32fast::Hasher;
    let mut hasher = Hasher::new();
    hasher.update(data);
    hasher.finalize()
}

#[wasm_bindgen]
pub fn check_quality(bitrate: u32) -> String {
    if bitrate < 5000 {
        format!("Bitrate faible: {} kbps - Qualité SD", bitrate)
    } else {
        format!("Bitrate actuel: {} kbps - Analysé par Rust", bitrate)
    }
}

// =========================
// === SMART GATE AUDIO  ===
// =========================

#[wasm_bindgen]
pub struct SmartGate {
    threshold: f32,
    attack: f32,
    release: f32,
    current_gain: f32,
    auto_mode: bool,
    noise_floor: f32,
}

#[wasm_bindgen]
impl SmartGate {
    #[wasm_bindgen(constructor)]
    pub fn new(threshold: f32, attack: f32, release: f32) -> SmartGate {
        SmartGate {
            threshold,
            attack,
            release,
            current_gain: 0.0,
            auto_mode: false,
            noise_floor: 0.001,
        }
    }

    pub fn set_threshold(&mut self, threshold: f32) {
        self.threshold = threshold;
    }

    pub fn set_auto_mode(&mut self, auto: bool) {
        self.auto_mode = auto;
    }

    pub fn process(&mut self, audio: &mut [f32]) {
        let rms = rms_volume(audio);

        let target_gain = if self.auto_mode {
            // Adaptive auto VAD: maintain a dynamic noise floor estimation
            if rms < self.noise_floor {
                self.noise_floor = rms;
            } else {
                // slowly adapt noise floor upward against steady-state noise
                self.noise_floor += (rms - self.noise_floor) * 0.0001;
            }
            // Trigger threshold is dynamic: 4x the noise floor, with a minimum bottom
            if rms > (self.noise_floor * 4.0).max(0.005) { 1.0 } else { 0.0 }
        } else {
            // Manual fixed threshold
            if rms > self.threshold { 1.0 } else { 0.0 }
        };

        for sample in audio.iter_mut() {
            if target_gain > self.current_gain {
                self.current_gain = (self.current_gain + self.attack).min(1.0);
            } else {
                self.current_gain = (self.current_gain - self.release).max(0.0);
            }
            *sample *= self.current_gain;
        }
    }
}

// =========================
// === TRANSIENT SUPPRESSOR ===
// =========================

#[wasm_bindgen]
pub struct TransientSuppressor {
    fast_env: f32,
    slow_env: f32,
    threshold: f32,
}

#[wasm_bindgen]
impl TransientSuppressor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> TransientSuppressor {
        TransientSuppressor {
            fast_env: 0.0,
            slow_env: 0.0,
            threshold: 4.0, // Multiplicateur pour détection de crêtes
        }
    }

    pub fn process(&mut self, audio: &mut [f32]) {
        for sample in audio.iter_mut() {
            let abs_s = sample.abs();

            // Enveloppe rapide pour capter le clic immédiatement (~1ms @48kHz)
            self.fast_env = self.fast_env * 0.9 + abs_s * 0.1;

            // Enveloppe lente représentant l'énergie globale continue de la voix (~20ms @48kHz)
            self.slow_env = self.slow_env * 0.999 + abs_s * 0.001;

            // Si on détecte un pic très intense et soudain (typiquement clavier mécanique)
            if self.fast_env > self.slow_env * self.threshold {
                let target_gain = (self.slow_env * self.threshold) / self.fast_env.max(0.0001);
                // On lisse légèrement la réduction
                *sample *= target_gain.powf(1.5);
            }
        }
    }
}
