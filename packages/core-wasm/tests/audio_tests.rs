/// Audio DSP function tests: detect_peak, rms_volume, detect_silence,
/// compress_audio, detect_clipping, crest_factor, normalize_audio,
/// dominant_freq, white_noise.
use core_wasm::*;

// ───────────────────────── detect_peak ─────────────────────────

#[test]
fn detect_peak_above_threshold() {
    let audio = [0.1, 0.2, 0.8, 0.3];
    assert!(detect_peak(&audio, 0.5));
}

#[test]
fn detect_peak_below_threshold() {
    let audio = [0.1, 0.2, 0.3];
    assert!(!detect_peak(&audio, 0.5));
}

#[test]
fn detect_peak_empty() {
    assert!(!detect_peak(&[], 0.5));
}

#[test]
fn detect_peak_negative_samples() {
    let audio = [0.1, -0.9, 0.2];
    assert!(detect_peak(&audio, 0.5));
}

// ───────────────────────── rms_volume ─────────────────────────

#[test]
fn rms_volume_empty_returns_zero() {
    assert_eq!(rms_volume(&[]), 0.0);
}

#[test]
fn rms_volume_constant_signal() {
    let audio = [0.5_f32; 100];
    let rms = rms_volume(&audio);
    assert!((rms - 0.5).abs() < 1e-5);
}

#[test]
fn rms_volume_silence() {
    let audio = [0.0_f32; 128];
    assert_eq!(rms_volume(&audio), 0.0);
}

#[test]
fn rms_volume_single_sample() {
    assert!((rms_volume(&[0.7]) - 0.7).abs() < 1e-5);
}

// ───────────────────────── detect_silence ─────────────────────

#[test]
fn detect_silence_all_below() {
    let audio = [0.001, -0.002, 0.0005];
    assert!(detect_silence(&audio, 0.01));
}

#[test]
fn detect_silence_one_above() {
    let audio = [0.001, 0.5, 0.002];
    assert!(!detect_silence(&audio, 0.01));
}

#[test]
fn detect_silence_empty_is_silent() {
    assert!(detect_silence(&[], 0.01));
}

// ───────────────────────── compress_audio ─────────────────────

#[test]
fn compress_audio_below_threshold_unchanged() {
    let audio = [0.1, 0.2, 0.3];
    let out = compress_audio(&audio, 0.5, 4.0);
    assert_eq!(out, audio.to_vec());
}

#[test]
fn compress_audio_above_threshold_compressed() {
    let audio = [0.8];
    let out = compress_audio(&audio, 0.5, 4.0);
    // excess = 0.3, compressed = 0.5 + 0.3/4 = 0.575
    assert!((out[0] - 0.575).abs() < 1e-5);
}

#[test]
fn compress_audio_negative_sample() {
    let audio = [-0.8];
    let out = compress_audio(&audio, 0.5, 4.0);
    assert!((out[0] - (-0.575)).abs() < 1e-5);
}

#[test]
fn compress_audio_ratio_one_passthrough() {
    let audio = [0.9];
    let out = compress_audio(&audio, 0.5, 1.0);
    assert!((out[0] - 0.9).abs() < 1e-5);
}

// ───────────────────────── detect_clipping ────────────────────

#[test]
fn detect_clipping_with_clipped_sample() {
    assert!(detect_clipping(&[0.3, 1.0, 0.5], 0.99));
}

#[test]
fn detect_clipping_no_clip() {
    assert!(!detect_clipping(&[0.3, 0.5, 0.7], 0.99));
}

// ───────────────────────── crest_factor ───────────────────────

#[test]
fn crest_factor_constant_signal_equals_one() {
    let audio = [0.5_f32; 100];
    let cf = crest_factor(&audio);
    assert!((cf - 1.0).abs() < 1e-4);
}

#[test]
fn crest_factor_silence_returns_zero() {
    let audio = [0.0_f32; 64];
    assert_eq!(crest_factor(&audio), 0.0);
}

// ───────────────────────── normalize_audio ────────────────────

#[test]
fn normalize_audio_scales_to_one() {
    let audio = [0.2, -0.4, 0.1];
    let out = normalize_audio(&audio);
    let peak = out.iter().map(|x| x.abs()).fold(0.0_f32, f32::max);
    assert!((peak - 1.0).abs() < 1e-5);
}

#[test]
fn normalize_audio_silence_unchanged() {
    let audio = [0.0_f32; 8];
    assert_eq!(normalize_audio(&audio), audio.to_vec());
}

#[test]
fn normalize_audio_already_normalized() {
    let audio = [1.0, -0.5, 0.3];
    let out = normalize_audio(&audio);
    assert!((out[0] - 1.0).abs() < 1e-5);
}

// ───────────────────────── dominant_freq ──────────────────────

#[test]
fn dominant_freq_short_input() {
    assert_eq!(dominant_freq(&[0.5], 48000.0), 0.0);
}

#[test]
fn dominant_freq_sine_wave() {
    let sample_rate = 48000.0_f32;
    let freq = 440.0_f32;
    let samples: Vec<f32> = (0..4800)
        .map(|i| (2.0 * std::f32::consts::PI * freq * i as f32 / sample_rate).sin())
        .collect();
    let detected = dominant_freq(&samples, sample_rate);
    // Autocorrelation-based — allow ±5 Hz tolerance
    assert!(
        (detected - freq).abs() < 5.0,
        "detected {detected} Hz, expected ~{freq} Hz"
    );
}

// ───────────────────────── white_noise ────────────────────────

#[test]
fn white_noise_length() {
    let out = white_noise(256, 1.0, 42);
    assert_eq!(out.len(), 256);
}

#[test]
fn white_noise_amplitude_range() {
    let out = white_noise(1024, 0.5, 7);
    for &s in &out {
        assert!(s.abs() <= 0.51, "sample {s} out of range");
    }
}

#[test]
fn white_noise_different_seeds_differ() {
    let a = white_noise(64, 1.0, 1);
    let b = white_noise(64, 1.0, 2);
    assert_ne!(a, b);
}
