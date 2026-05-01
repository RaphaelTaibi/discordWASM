use std::sync::Arc;
use std::thread;

use dashmap::DashMap;
use prost::Message;
use tokio::sync::Notify;

use crate::store::{FriendRecord, Store, StoreSnapshot, UserRecord};

/// Builds a minimal `UserRecord` for testing.
fn make_user(idx: usize) -> UserRecord {
    UserRecord {
        id: format!("user-{idx}"),
        username: format!("user_{idx}"),
        display_name: format!("User {idx}"),
        password_hash: None,
        avatar: None,
        public_key: Some(format!("pk-{idx}")),
        created_at_ms: 1_700_000_000_000 + idx as i64,
    }
}

fn make_friend(idx: usize, from: usize, to: usize) -> FriendRecord {
    FriendRecord {
        id: format!("fr-{idx}"),
        from_user_id: format!("user-{from}"),
        to_user_id: format!("user-{to}"),
        status: "accepted".into(),
        created_at_ms: 1_700_000_000_000 + idx as i64,
    }
}

/// Creates an empty store backed by a temp file.
fn temp_store(dir: &std::path::Path) -> Store {
    let path = dir.join("test_auth.bin");
    Store {
        users: Arc::new(DashMap::new()),
        username_index: Arc::new(DashMap::new()),
        pubkey_index: Arc::new(DashMap::new()),
        friends: Arc::new(DashMap::new()),
        dirty: Arc::new(Notify::new()),
        path: Arc::new(path.to_string_lossy().into_owned()),
    }
}

// ---------------------------------------------------------------------------
// 1. Protobuf round-trip: users + friends survive flush → reload
// ---------------------------------------------------------------------------

#[test]
fn roundtrip_users_and_friends() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let store = temp_store(dir.path());

    let u = make_user(1);
    store.users.insert(u.id.clone(), u.clone());
    store
        .username_index
        .insert(u.username.to_lowercase(), u.id.clone());

    let f = make_friend(1, 1, 2);
    store.friends.insert(f.id.clone(), f.clone());

    store.flush().expect("flush");

    let reloaded = Store::load(&dir.path().join("test_auth.bin").to_string_lossy());
    assert_eq!(reloaded.users.len(), 1);
    assert_eq!(reloaded.friends.len(), 1);

    let ru = reloaded.users.get("user-1").expect("user exists");
    assert_eq!(ru.username, "user_1");
    assert_eq!(ru.display_name, "User 1");
    assert_eq!(ru.public_key, Some("pk-1".into()));
}

// ---------------------------------------------------------------------------
// 2. Secondary indexes rebuilt correctly on load
// ---------------------------------------------------------------------------

#[test]
fn indexes_rebuilt_on_load() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let store = temp_store(dir.path());

    for i in 0..50 {
        let u = make_user(i);
        store
            .username_index
            .insert(u.username.to_lowercase(), u.id.clone());
        if let Some(ref pk) = u.public_key {
            store.pubkey_index.insert(pk.clone(), u.id.clone());
        }
        store.users.insert(u.id.clone(), u);
    }
    store.flush().expect("flush");

    let reloaded = Store::load(&dir.path().join("test_auth.bin").to_string_lossy());
    assert_eq!(reloaded.users.len(), 50);
    assert_eq!(reloaded.username_index.len(), 50);
    assert_eq!(reloaded.pubkey_index.len(), 50);

    // Verify index pointers
    let uid = reloaded
        .username_index
        .get("user_25")
        .expect("username index");
    assert_eq!(uid.value(), "user-25");

    let uid_pk = reloaded.pubkey_index.get("pk-25").expect("pubkey index");
    assert_eq!(uid_pk.value(), "user-25");
}

// ---------------------------------------------------------------------------
// 3. 1000 concurrent user inserts + flush integrity
// ---------------------------------------------------------------------------

#[test]
fn concurrent_1000_user_inserts() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let store = Arc::new(temp_store(dir.path()));

    let handles: Vec<_> = (0..1000)
        .map(|i| {
            let s = Arc::clone(&store);
            thread::spawn(move || {
                let u = make_user(i);
                s.username_index
                    .insert(u.username.to_lowercase(), u.id.clone());
                if let Some(ref pk) = u.public_key {
                    s.pubkey_index.insert(pk.clone(), u.id.clone());
                }
                s.users.insert(u.id.clone(), u);
            })
        })
        .collect();

    for h in handles {
        h.join().expect("join");
    }

    assert_eq!(store.users.len(), 1000);
    store.flush().expect("flush");

    let reloaded = Store::load(&dir.path().join("test_auth.bin").to_string_lossy());
    assert_eq!(reloaded.users.len(), 1000);
    assert_eq!(reloaded.username_index.len(), 1000);
    assert_eq!(reloaded.pubkey_index.len(), 1000);
}

// ---------------------------------------------------------------------------
// 4. Atomic write: no leftover .bin.tmp
// ---------------------------------------------------------------------------

#[test]
fn no_leftover_tmp_after_flush() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let store = temp_store(dir.path());
    store.users.insert("u1".into(), make_user(1));
    store.flush().expect("flush");

    assert!(!dir.path().join("test_auth.bin.tmp").exists());
    assert!(dir.path().join("test_auth.bin").exists());
}

// ---------------------------------------------------------------------------
// 5. Load nonexistent file → empty store
// ---------------------------------------------------------------------------

#[test]
fn load_nonexistent_yields_empty() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let store = Store::load(&dir.path().join("nope.bin").to_string_lossy());
    assert_eq!(store.users.len(), 0);
    assert_eq!(store.friends.len(), 0);
}

// ---------------------------------------------------------------------------
// 6. Protobuf binary integrity under concurrent writes + flushes
// ---------------------------------------------------------------------------

#[test]
fn concurrent_writes_and_flushes() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let store = Arc::new(temp_store(dir.path()));

    let mut handles: Vec<thread::JoinHandle<()>> = (0..10)
        .map(|t| {
            let s = Arc::clone(&store);
            thread::spawn(move || {
                for i in 0..100 {
                    let idx = t * 100 + i;
                    let u = make_user(idx);
                    s.users.insert(u.id.clone(), u);
                }
            })
        })
        .collect();

    for _ in 0..3 {
        let s = Arc::clone(&store);
        handles.push(thread::spawn(move || {
            for _ in 0..10 {
                let _ = s.flush();
                thread::sleep(std::time::Duration::from_micros(50));
            }
        }));
    }

    for h in handles {
        h.join().expect("join");
    }
    store.flush().expect("final flush");

    let raw = std::fs::read(dir.path().join("test_auth.bin")).expect("read");
    let snap = StoreSnapshot::decode(raw.as_slice()).expect("decode");
    assert_eq!(snap.users.len(), 1000);
}

// ---------------------------------------------------------------------------
// 7. Repeated flush + reload cycle consistency
// ---------------------------------------------------------------------------

#[test]
fn repeated_flush_reload_consistency() {
    let dir = tempfile::tempdir().expect("tmpdir");
    let path = dir.path().join("cycle.bin").to_string_lossy().into_owned();

    for round in 0..10 {
        let store = Store::load(&path);
        let base = round * 20;
        for i in base..(base + 20) {
            let u = make_user(i);
            store
                .username_index
                .insert(u.username.to_lowercase(), u.id.clone());
            if let Some(ref pk) = u.public_key {
                store.pubkey_index.insert(pk.clone(), u.id.clone());
            }
            store.users.insert(u.id.clone(), u);
        }
        store.flush().expect("flush");
    }

    let final_store = Store::load(&path);
    assert_eq!(final_store.users.len(), 200, "10 rounds × 20 users");
}
