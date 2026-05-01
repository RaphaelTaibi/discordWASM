use std::sync::Arc;
use std::thread;

use dashmap::DashMap;
use tokio::sync::Notify;

use crate::fraud::detector::FraudDetector;
use crate::fraud::store::BanStore;

/// Creates an in-memory BanStore backed by a temp file.
fn temp_ban_store(dir: &std::path::Path) -> BanStore {
    let path = dir.join("det_bans.bin");
    BanStore {
        entries: Arc::new(DashMap::new()),
        recidivism: Arc::new(DashMap::new()),
        fingerprints: Arc::new(DashMap::new()),
        dirty: Arc::new(Notify::new()),
        path: Arc::new(path.to_string_lossy().into_owned()),
    }
}

// ---------------------------------------------------------------------------
// 1. Below login-fail threshold: IP not banned
// ---------------------------------------------------------------------------

#[test]
fn login_fail_below_threshold_no_ban() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let bans = temp_ban_store(dir.path());
    let detector = FraudDetector::new();

    for _ in 0..9 {
        let banned = detector.record_login_fail("10.0.0.1", &bans);
        assert!(!banned);
    }
    assert!(!bans.is_banned("10.0.0.1"));
}

// ---------------------------------------------------------------------------
// 2. At login-fail threshold: IP gets banned
// ---------------------------------------------------------------------------

#[test]
fn login_fail_at_threshold_bans() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let bans = temp_ban_store(dir.path());
    let detector = FraudDetector::new();

    for _ in 0..9 {
        detector.record_login_fail("10.0.0.2", &bans);
    }
    let banned = detector.record_login_fail("10.0.0.2", &bans);
    assert!(banned);
    assert!(bans.is_banned("10.0.0.2"));
}

// ---------------------------------------------------------------------------
// 3. Invalid token threshold triggers ban
// ---------------------------------------------------------------------------

#[test]
fn invalid_token_threshold_bans() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let bans = temp_ban_store(dir.path());
    let detector = FraudDetector::new();

    for _ in 0..4 {
        assert!(!detector.record_invalid_token("10.0.0.3", &bans));
    }
    assert!(detector.record_invalid_token("10.0.0.3", &bans));
    assert!(bans.is_banned("10.0.0.3"));
}

// ---------------------------------------------------------------------------
// 4. WS flood threshold triggers ban
// ---------------------------------------------------------------------------

#[test]
fn ws_flood_threshold_bans() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let bans = temp_ban_store(dir.path());
    let detector = FraudDetector::new();

    for _ in 0..19 {
        assert!(!detector.record_ws_connect("10.0.0.4", &bans));
    }
    assert!(detector.record_ws_connect("10.0.0.4", &bans));
    assert!(bans.is_banned("10.0.0.4"));
}

// ---------------------------------------------------------------------------
// 5. Different IPs tracked independently
// ---------------------------------------------------------------------------

#[test]
fn different_ips_independent() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let bans = temp_ban_store(dir.path());
    let detector = FraudDetector::new();

    for _ in 0..5 {
        detector.record_login_fail("1.1.1.1", &bans);
    }
    for _ in 0..5 {
        detector.record_login_fail("2.2.2.2", &bans);
    }
    assert!(!bans.is_banned("1.1.1.1"));
    assert!(!bans.is_banned("2.2.2.2"));
}

// ---------------------------------------------------------------------------
// 6. Cleanup removes stale entries without affecting recent ones
// ---------------------------------------------------------------------------

#[test]
fn cleanup_preserves_recent_entries() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let bans = temp_ban_store(dir.path());
    let detector = FraudDetector::new();

    // Record some events (recent — they'll survive cleanup)
    for _ in 0..5 {
        detector.record_login_fail("10.0.0.5", &bans);
    }

    detector.cleanup();

    // Events still tracked (recent, within 120s cutoff)
    // 5 events survived + 5 more should trigger ban at 10 total
    for _ in 0..4 {
        detector.record_login_fail("10.0.0.5", &bans);
    }
    let banned = detector.record_login_fail("10.0.0.5", &bans);
    assert!(banned);
}

// ---------------------------------------------------------------------------
// 7. After ban, sliding window is reset (cleared)
// ---------------------------------------------------------------------------

#[test]
fn window_reset_after_ban() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let bans = temp_ban_store(dir.path());
    let detector = FraudDetector::new();

    // Trigger ban
    for _ in 0..10 {
        detector.record_login_fail("10.0.0.6", &bans);
    }
    assert!(bans.is_banned("10.0.0.6"));

    // The window was cleared — one more event alone should not re-ban
    // (the IP is already banned by the store but the detector window is reset)
    // We can verify the detector's internal state by checking that
    // new events start counting from 0.
    let not_triggered = detector.record_login_fail("10.0.0.6", &bans);
    // Already banned so the ban call is cumulative — the return value
    // just tells us if the threshold was hit *this time*.
    assert!(
        !not_triggered,
        "single event after reset should not re-trigger"
    );
}

// ---------------------------------------------------------------------------
// 8. Concurrent fraud recording does not panic
// ---------------------------------------------------------------------------

#[test]
fn concurrent_recording_no_panic() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let bans = Arc::new(temp_ban_store(dir.path()));
    let detector = Arc::new(FraudDetector::new());

    let handles: Vec<_> = (0..100)
        .map(|i| {
            let d = Arc::clone(&detector);
            let b = Arc::clone(&bans);
            thread::spawn(move || {
                let ip = format!("172.16.{}.{}", i / 256, i % 256);
                d.record_login_fail(&ip, &b);
                d.record_invalid_token(&ip, &b);
                d.record_ws_connect(&ip, &b);
            })
        })
        .collect();

    for h in handles {
        h.join().expect("join");
    }
    // No panic = success
}
