// Copyright (c) Void Contributors.
// Licensed under the Business Source License 1.1 (BSL).
// See the LICENSE file at the repository root for full terms.

//! Criterion benchmarks for the `core-wasm` DSP hot paths.
//!
//! Run with:
//! ```bash
//! cargo bench -p core-wasm --features bench
//! ```
//!
//! These benchmarks intentionally target the *native* build (not wasm32) so
//! we can leverage criterion's statistical sampler. The wasm-bindgen surface
//! is bypassed because criterion cannot drive the JS bridge; we instead
//! exercise the underlying Rust functions which carry the actual DSP cost.

use core_wasm::{
    __bench_compute_seal, SmartGate, TransientSuppressor, activate_rt_context, color_histogram,
    compress_audio, compute_fingerprint, crc32_hash, crest_factor, detect_clipping, detect_peak,
    detect_silence, dominant_freq, is_frozen_frame, normalize_audio, rms_volume, white_noise,
};
use criterion::{BenchmarkId, Criterion, Throughput, black_box, criterion_group, criterion_main};

/// Realistic frame size: 10 ms @ 48 kHz mono = 480 samples.
const FRAME_480: usize = 480;
/// 20 ms frame.
const FRAME_960: usize = 960;
/// Larger window for FFT-style analysis benchmarks.
const FRAME_4096: usize = 4096;

/// Generates a deterministic test signal: a sine wave plus low-amplitude noise.
fn synth_signal(len: usize) -> Vec<f32> {
    let mut out = Vec::with_capacity(len);
    for i in 0..len {
        let t = i as f32 / 48_000.0;
        let sine = (2.0 * std::f32::consts::PI * 440.0 * t).sin() * 0.6;
        let noise = ((i.wrapping_mul(2654435761)) as f32 / u32::MAX as f32) * 0.05;
        out.push(sine + noise);
    }
    out
}

/// Synthetic 1080p-ish RGBA frame stub used by the video helpers.
fn synth_rgba_frame(width: u32, height: u32) -> Vec<u8> {
    let n = (width as usize) * (height as usize) * 4;
    (0..n).map(|i| (i & 0xFF) as u8).collect()
}

fn bench_audio_analysis(c: &mut Criterion) {
    let mut group = c.benchmark_group("audio_analysis");

    for &size in &[FRAME_480, FRAME_960, FRAME_4096] {
        let signal = synth_signal(size);
        group.throughput(Throughput::Elements(size as u64));

        group.bench_with_input(BenchmarkId::new("detect_peak", size), &signal, |b, s| {
            b.iter(|| detect_peak(black_box(s), black_box(0.5)))
        });
        group.bench_with_input(BenchmarkId::new("rms_volume", size), &signal, |b, s| {
            b.iter(|| rms_volume(black_box(s)))
        });
        group.bench_with_input(BenchmarkId::new("detect_silence", size), &signal, |b, s| {
            b.iter(|| detect_silence(black_box(s), black_box(0.01)))
        });
        group.bench_with_input(
            BenchmarkId::new("detect_clipping", size),
            &signal,
            |b, s| b.iter(|| detect_clipping(black_box(s), black_box(0.95))),
        );
        group.bench_with_input(BenchmarkId::new("crest_factor", size), &signal, |b, s| {
            b.iter(|| crest_factor(black_box(s)))
        });
        group.bench_with_input(BenchmarkId::new("dominant_freq", size), &signal, |b, s| {
            b.iter(|| dominant_freq(black_box(s), black_box(48_000.0)))
        });
    }

    group.finish();
}

fn bench_audio_fx(c: &mut Criterion) {
    let mut group = c.benchmark_group("audio_fx");

    let signal = synth_signal(FRAME_960);
    group.throughput(Throughput::Elements(FRAME_960 as u64));

    group.bench_function("compress_audio", |b| {
        b.iter(|| compress_audio(black_box(&signal), black_box(0.3), black_box(4.0)))
    });

    group.bench_function("normalize_audio", |b| {
        b.iter(|| normalize_audio(black_box(&signal)))
    });

    group.bench_function("white_noise_960", |b| {
        b.iter(|| white_noise(black_box(FRAME_960), black_box(0.1), black_box(42)))
    });

    group.finish();
}

fn bench_processors(c: &mut Criterion) {
    // Activate the runtime context so SmartGate/TransientSuppressor exercise
    // the real (non-fallback) hot path.
    assert!(activate_rt_context(__bench_compute_seal()));

    let mut group = c.benchmark_group("processors");
    group.throughput(Throughput::Elements(FRAME_960 as u64));

    group.bench_function("smart_gate_manual", |b| {
        let mut gate = SmartGate::new(0.05, 0.01, 0.005);
        let mut buffer = synth_signal(FRAME_960);
        b.iter(|| {
            gate.process(black_box(&mut buffer));
        });
    });

    group.bench_function("smart_gate_auto", |b| {
        let mut gate = SmartGate::new(0.05, 0.01, 0.005);
        gate.set_auto_mode(true);
        let mut buffer = synth_signal(FRAME_960);
        b.iter(|| {
            gate.process(black_box(&mut buffer));
        });
    });

    group.bench_function("transient_suppressor", |b| {
        let mut ts = TransientSuppressor::new();
        let mut buffer = synth_signal(FRAME_960);
        b.iter(|| {
            ts.process(black_box(&mut buffer));
        });
    });

    group.finish();
}

fn bench_hash_and_video(c: &mut Criterion) {
    let mut group = c.benchmark_group("hash_and_video");

    let payload = vec![0xABu8; 4096];
    group.throughput(Throughput::Bytes(payload.len() as u64));
    group.bench_function("crc32_hash_4k", |b| {
        b.iter(|| crc32_hash(black_box(&payload)))
    });

    let signals = "ua=Mozilla/5.0;tz=Europe/Paris;lang=fr-FR;screen=1920x1080;cores=12";
    group.bench_function("compute_fingerprint", |b| {
        b.iter(|| compute_fingerprint(black_box(signals)))
    });

    let frame_a = synth_rgba_frame(320, 180);
    let frame_b = synth_rgba_frame(320, 180);
    group.throughput(Throughput::Bytes(frame_a.len() as u64));
    group.bench_function("color_histogram_320x180", |b| {
        b.iter(|| color_histogram(black_box(&frame_a)))
    });
    group.bench_function("is_frozen_frame_320x180", |b| {
        b.iter(|| is_frozen_frame(black_box(&frame_a), black_box(&frame_b), black_box(2)))
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_audio_analysis,
    bench_audio_fx,
    bench_processors,
    bench_hash_and_video
);
criterion_main!(benches);
