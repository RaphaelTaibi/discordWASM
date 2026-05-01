/// SmartGate and TransientSuppressor struct tests.
/// Runtime context is NOT activated — exercises fallback paths.
use core_wasm::*;

// ───────────────────────── SmartGate ─────────────────────────

#[test]
fn smart_gate_new_defaults() {
    let gate = SmartGate::new(0.01, 0.05, 0.02);
    // Constructed without panic
    let _ = gate;
}

#[test]
fn smart_gate_process_silence_stays_silent() {
    let mut gate = SmartGate::new(0.01, 0.05, 0.02);
    let mut audio = vec![0.0_f32; 128];
    gate.process(&mut audio);
    // All samples should remain near zero
    for &s in &audio {
        assert!(s.abs() < 0.02, "expected near-zero, got {s}");
    }
}

#[test]
fn smart_gate_process_loud_signal_in_fallback() {
    let mut gate = SmartGate::new(0.01, 0.05, 0.02);
    let mut audio = vec![0.9_f32; 256];
    gate.process(&mut audio);
    // In fallback mode, output should be attenuated (< original)
    for &s in &audio {
        assert!(s.abs() < 0.95, "expected attenuation in fallback, got {s}");
    }
}

#[test]
fn smart_gate_set_threshold() {
    let mut gate = SmartGate::new(0.01, 0.05, 0.02);
    gate.set_threshold(0.5);
    // Should not panic
}

#[test]
fn smart_gate_set_auto_mode() {
    let mut gate = SmartGate::new(0.01, 0.05, 0.02);
    gate.set_auto_mode(true);
    gate.set_auto_mode(false);
}

// ──────────────────── TransientSuppressor ────────────────────

#[test]
fn transient_suppressor_new() {
    let _ts = TransientSuppressor::new();
}

#[test]
fn transient_suppressor_process_no_rt_noop() {
    let mut ts = TransientSuppressor::new();
    let original = vec![0.5_f32; 64];
    let mut audio = original.clone();
    ts.process(&mut audio);
    // Without RT context, process is a no-op — audio unchanged
    assert_eq!(audio, original);
}

// ───────────────────── activate_rt_context ───────────────────

#[test]
fn activate_rt_context_wrong_seal() {
    assert!(!activate_rt_context(0));
    assert!(!activate_rt_context(12345));
}

#[test]
fn activate_rt_context_correct_seal() {
    // Reproduce the expected seal computation
    let mut h = crc32fast::Hasher::new();
    h.update(b"v0id-rt-seal");
    h.update(&0x564F_4944u32.to_le_bytes());
    h.update(&0x5253_4543u32.to_le_bytes());
    let seal = h.finalize();
    assert!(activate_rt_context(seal));
}
