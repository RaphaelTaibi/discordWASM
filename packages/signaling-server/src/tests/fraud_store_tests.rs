use std::sync::Arc;
use std::thread;

use dashmap::DashMap;
use prost::Message;
use tokio::sync::Notify;

use crate::fraud::store::{BanSnapshot, BanStore};

/// Creates an empty BanStore backed by a temp file.
fn temp_ban_store(dir: &std::path::Path) -> BanStore {
    let path = dir.join("test_bans.bin");
    BanStore {
        entries: Arc::new(DashMap::new()),
        recidivism: Arc::new(DashMap::new()),
        fingerprints: Arc::new(DashMap::new()),
        dirty: Arc::new(Notify::new()),
        path: Arc::new(path.to_string_lossy().into_owned()),
    }
}

// ---------------------------------------------------------------------------
// 1. Ban + is_banned returns true for active ban
// ---------------------------------------------------------------------------

#[test]
fn ban_then_is_banned() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let store = temp_ban_store(dir.path());
    store.ban("1.2.3.4".into(), "test".into(), 60_000);
    assert!(store.is_banned("1.2.3.4"));
}

// ---------------------------------------------------------------------------
// 2. Unknown IP is not banned
// ---------------------------------------------------------------------------

#[test]
fn unknown_ip_not_banned() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let store = temp_ban_store(dir.path());
    assert!(!store.is_banned("5.6.7.8"));
}

// ---------------------------------------------------------------------------
// 3. Permanent ban (duration=0) never expires
// ---------------------------------------------------------------------------

#[test]
fn permanent_ban_persists() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let store = temp_ban_store(dir.path());
    store.ban("10.0.0.1".into(), "permanent".into(), 0);
    assert!(store.is_banned("10.0.0.1"));

    let record = store.entries.get("10.0.0.1").expect("record");
    assert_eq!(record.expires_at_ms, 0);
}

// ---------------------------------------------------------------------------
// 4. Protobuf round-trip: bans + recidivism + fingerprints
// ---------------------------------------------------------------------------

#[test]
fn roundtrip_flush_reload() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let store = temp_ban_store(dir.path());

    store.ban("1.1.1.1".into(), "spam".into(), 60_000);
    store.ban("2.2.2.2".into(), "abuse".into(), 0);
    store.record_fingerprint("fp-abc", "1.1.1.1");
    store.record_fingerprint("fp-abc", "3.3.3.3");

    store.flush().expect("flush");

    let reloaded = BanStore::load(&dir.path().join("test_bans.bin").to_string_lossy());
    assert_eq!(reloaded.entries.len(), 2);
    assert!(reloaded.is_banned("1.1.1.1"));
    assert!(reloaded.is_banned("2.2.2.2"));

    let fp = reloaded.fingerprints.get("fp-abc").expect("fingerprint");
    assert_eq!(fp.ips.len(), 2);
}

// ---------------------------------------------------------------------------
// 5. Recidivism escalation: 3 bans in window â†’ permanent
// ---------------------------------------------------------------------------

#[test]
fn recidivism_escalation_to_permanent() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let store = temp_ban_store(dir.path());

    // 3 bans within the window should trigger permanent
    store.ban("9.9.9.9".into(), "strike1".into(), 10_000);
    store.ban("9.9.9.9".into(), "strike2".into(), 10_000);
    store.ban("9.9.9.9".into(), "strike3".into(), 10_000);

    let record = store.entries.get("9.9.9.9").expect("record");
    assert_eq!(
        record.expires_at_ms, 0,
        "3rd strike must escalate to permanent"
    );
}

// ---------------------------------------------------------------------------
// 6. Concurrent bans on 1000 distinct IPs
// ---------------------------------------------------------------------------

#[test]
fn concurrent_1000_bans() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let store = Arc::new(temp_ban_store(dir.path()));

    let handles: Vec<_> = (0..1000)
        .map(|i| {
            let s = Arc::clone(&store);
            thread::spawn(move || {
                let ip = format!("10.0.{}.{}", i / 256, i % 256);
                s.ban(ip, format!("reason-{i}"), 60_000);
            })
        })
        .collect();

    for h in handles {
        h.join().expect("join");
    }
    assert_eq!(store.entries.len(), 1000);

    store.flush().expect("flush");
    let raw = std::fs::read(dir.path().join("test_bans.bin")).expect("read");
    let snap = BanSnapshot::decode(raw.as_slice()).expect("decode");
    assert_eq!(snap.bans.len(), 1000);
}

// ---------------------------------------------------------------------------
// 7. Atomic write: no leftover .bin.tmp
// ---------------------------------------------------------------------------

#[test]
fn no_leftover_tmp_after_flush() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let store = temp_ban_store(dir.path());
    store.ban("1.1.1.1".into(), "test".into(), 60_000);
    store.flush().expect("flush");

    assert!(!dir.path().join("test_bans.bin.tmp").exists());
    assert!(dir.path().join("test_bans.bin").exists());
}

// ---------------------------------------------------------------------------
// 8. Load nonexistent file â†’ empty store
// ---------------------------------------------------------------------------

#[test]
fn load_nonexistent_yields_empty() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let store = BanStore::load(&dir.path().join("nope.bin").to_string_lossy());
    assert_eq!(store.entries.len(), 0);
}

// ---------------------------------------------------------------------------
// 9. Fingerprint abuse: 50+ IPs on same fingerprint â†’ all permanently banned
// ---------------------------------------------------------------------------

#[test]
fn fingerprint_abuse_mass_ban() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let store = temp_ban_store(dir.path());

    for i in 0..49 {
        let ip = format!("192.168.0.{i}");
        let banned = store.record_fingerprint("evil-fp", &ip);
        assert!(banned.is_empty(), "below threshold");
    }

    // 50th IP triggers the mass ban
    let banned = store.record_fingerprint("evil-fp", "192.168.0.49");
    assert_eq!(banned.len(), 50, "all 50 IPs must be banned");

    for i in 0..50 {
        let ip = format!("192.168.0.{i}");
        assert!(store.is_banned(&ip), "{ip} must be permanently banned");
    }
}
