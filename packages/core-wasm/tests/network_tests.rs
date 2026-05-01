/// Network, conversion, and hashing function tests.
use core_wasm::*;

// ───────────────── calculate_network_quality ──────────────────

#[test]
fn network_quality_excellent() {
    assert_eq!(calculate_network_quality(50.0, 0.01, 10.0), 3);
}

#[test]
fn network_quality_medium_latency() {
    assert_eq!(calculate_network_quality(200.0, 0.01, 10.0), 2);
}

#[test]
fn network_quality_medium_loss() {
    assert_eq!(calculate_network_quality(50.0, 0.08, 10.0), 2);
}

#[test]
fn network_quality_medium_jitter() {
    assert_eq!(calculate_network_quality(50.0, 0.01, 50.0), 2);
}

#[test]
fn network_quality_bad_latency() {
    assert_eq!(calculate_network_quality(500.0, 0.01, 10.0), 1);
}

#[test]
fn network_quality_bad_loss() {
    assert_eq!(calculate_network_quality(50.0, 0.20, 10.0), 1);
}

#[test]
fn network_quality_bad_jitter() {
    assert_eq!(calculate_network_quality(50.0, 0.01, 150.0), 1);
}

// ──────────────── process_network_stats ───────────────────────

#[test]
fn process_network_stats_averaged() {
    let result = process_network_stats(200.0, 2.0, 0.0, 0.0, 0.1, 40.0);
    // final_rtt = 100, loss = 0.05, jitter = 20
    assert_eq!(result.len(), 5);
    assert_eq!(result[0], 100.0); // ping
    assert!((result[1] - 5.0).abs() < 0.01); // loss %
    assert!((result[2] - 20.0).abs() < 0.01); // jitter
}

#[test]
fn process_network_stats_candidate_pair_fallback() {
    let result = process_network_stats(0.0, 0.0, 42.0, 0.0, 0.0, 0.0);
    assert_eq!(result[4], 42.0); // final_rtt from candidate pair
}

#[test]
fn process_network_stats_rtt_fallback() {
    let result = process_network_stats(0.0, 0.0, 0.0, 99.0, 0.0, 0.0);
    assert_eq!(result[4], 99.0); // final_rtt from fallback
}

#[test]
fn process_network_stats_zero_count() {
    let result = process_network_stats(0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
    assert_eq!(result[1], 0.0); // no loss
    assert_eq!(result[2], 0.0); // no jitter
}

// ──────────────── ms_to_samples / samples_to_ms ──────────────

#[test]
fn ms_to_samples_basic() {
    assert_eq!(ms_to_samples(1000.0, 48000.0), 48000);
}

#[test]
fn ms_to_samples_fractional() {
    assert_eq!(ms_to_samples(10.0, 48000.0), 480);
}

#[test]
fn samples_to_ms_basic() {
    let ms = samples_to_ms(48000, 48000.0);
    assert!((ms - 1000.0).abs() < 0.01);
}

#[test]
fn samples_to_ms_roundtrip() {
    let samples = ms_to_samples(25.0, 44100.0);
    let ms = samples_to_ms(samples, 44100.0);
    assert!((ms - 25.0).abs() < 0.1);
}

// ──────────────── crc32_hash ─────────────────────────────────

#[test]
fn crc32_hash_deterministic() {
    let a = crc32_hash(b"hello");
    let b = crc32_hash(b"hello");
    assert_eq!(a, b);
}

#[test]
fn crc32_hash_different_input() {
    assert_ne!(crc32_hash(b"hello"), crc32_hash(b"world"));
}

#[test]
fn crc32_hash_empty() {
    let _h = crc32_hash(b"");
    // Should not panic
}

// ──────────────── compute_fingerprint ────────────────────────

#[test]
fn compute_fingerprint_length() {
    let fp = compute_fingerprint("test-signal-data");
    assert_eq!(fp.len(), 16);
}

#[test]
fn compute_fingerprint_deterministic() {
    let a = compute_fingerprint("browser+gpu+screen");
    let b = compute_fingerprint("browser+gpu+screen");
    assert_eq!(a, b);
}

#[test]
fn compute_fingerprint_different_input() {
    let a = compute_fingerprint("input-a");
    let b = compute_fingerprint("input-b");
    assert_ne!(a, b);
}

#[test]
fn compute_fingerprint_hex_chars() {
    let fp = compute_fingerprint("data");
    assert!(fp.chars().all(|c| c.is_ascii_hexdigit()));
}

// ──────────────── check_quality ──────────────────────────────

#[test]
fn check_quality_low_bitrate() {
    let msg = check_quality(3000);
    assert!(msg.contains("faible"));
    assert!(msg.contains("SD"));
}

#[test]
fn check_quality_normal_bitrate() {
    let msg = check_quality(8000);
    assert!(msg.contains("Analysé par Rust"));
}
