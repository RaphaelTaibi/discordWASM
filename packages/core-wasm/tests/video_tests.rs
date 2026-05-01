/// Video analysis function tests: analyze_frame, is_black_frame,
/// is_white_frame, color_histogram, is_frozen_frame.
use core_wasm::*;

// ───────────────────────── analyze_frame ──────────────────────

#[test]
fn analyze_frame_basic() {
    // 2x2 RGBA frame, all red=128
    let data = vec![
        128, 0, 0, 255, 128, 0, 0, 255, 128, 0, 0, 255, 128, 0, 0, 255,
    ];
    let result = analyze_frame(&data, 2, 2);
    assert!(result.contains("2x2"));
    assert!(result.contains("128"));
}

// ───────────────────────── is_black_frame ─────────────────────

#[test]
fn is_black_frame_all_zeros() {
    let data = vec![0, 0, 0, 255, 0, 0, 0, 255];
    assert!(is_black_frame(&data, 10));
}

#[test]
fn is_black_frame_with_bright_pixel() {
    let data = vec![0, 0, 0, 255, 200, 200, 200, 255];
    assert!(!is_black_frame(&data, 10));
}

#[test]
fn is_black_frame_threshold_boundary() {
    let data = vec![9, 9, 9, 255];
    assert!(is_black_frame(&data, 10));
    let data_at = vec![10, 10, 10, 255];
    assert!(!is_black_frame(&data_at, 10));
}

// ───────────────────────── is_white_frame ─────────────────────

#[test]
fn is_white_frame_all_white() {
    let data = vec![255, 255, 255, 255, 255, 255, 255, 255];
    assert!(is_white_frame(&data, 200));
}

#[test]
fn is_white_frame_with_dark_pixel() {
    let data = vec![255, 255, 255, 255, 50, 50, 50, 255];
    assert!(!is_white_frame(&data, 200));
}

// ───────────────────────── color_histogram ────────────────────

#[test]
fn color_histogram_length() {
    let data = vec![100, 150, 200, 255];
    let hist = color_histogram(&data);
    // 256 bins × 3 channels = 768
    assert_eq!(hist.len(), 768);
}

#[test]
fn color_histogram_single_pixel() {
    let data = vec![10, 20, 30, 255];
    let hist = color_histogram(&data);
    // R channel: index 10 should be 1
    assert_eq!(hist[10], 1);
    // G channel: index 256 + 20 = 276 should be 1
    assert_eq!(hist[276], 1);
    // B channel: index 512 + 30 = 542 should be 1
    assert_eq!(hist[542], 1);
}

#[test]
fn color_histogram_two_identical_pixels() {
    let data = vec![50, 50, 50, 255, 50, 50, 50, 255];
    let hist = color_histogram(&data);
    assert_eq!(hist[50], 2); // R
    assert_eq!(hist[256 + 50], 2); // G
    assert_eq!(hist[512 + 50], 2); // B
}

// ───────────────────────── is_frozen_frame ────────────────────

#[test]
fn is_frozen_frame_identical() {
    let a = vec![100, 100, 100, 255, 50, 50, 50, 255];
    let b = a.clone();
    assert!(is_frozen_frame(&a, &b, 0));
}

#[test]
fn is_frozen_frame_within_tolerance() {
    let a = vec![100, 100, 100, 255];
    let b = vec![102, 98, 101, 254];
    assert!(is_frozen_frame(&a, &b, 3));
}

#[test]
fn is_frozen_frame_beyond_tolerance() {
    let a = vec![100, 100, 100, 255];
    let b = vec![200, 100, 100, 255];
    assert!(!is_frozen_frame(&a, &b, 5));
}

#[test]
fn is_frozen_frame_different_lengths() {
    let a = vec![100, 100, 100, 255];
    let b = vec![100, 100, 100, 255, 0, 0, 0, 255];
    assert!(!is_frozen_frame(&a, &b, 0));
}
