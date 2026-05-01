/// Identity struct serialization and IdentityMetaPublic conversion tests.
/// These test the pure data layer without Tauri AppHandle.
use desktop_lib::identity::{IdentityMeta, IdentityMetaPublic};

// ───────────────────── IdentityMeta serde ────────────────────

#[test]
fn identity_meta_serialize_roundtrip() {
    let meta = IdentityMeta {
        timestamp: 1700000000,
        public_key: "pk-test".to_string(),
        pseudo: "Alice".to_string(),
        password_hash: "$argon2id$hash".to_string(),
        avatar: Some("data:image/png;base64,abc".to_string()),
    };
    let json = serde_json::to_string(&meta).unwrap();
    let decoded: IdentityMeta = serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.timestamp, 1700000000);
    assert_eq!(decoded.public_key, "pk-test");
    assert_eq!(decoded.pseudo, "Alice");
    assert_eq!(decoded.password_hash, "$argon2id$hash");
    assert_eq!(
        decoded.avatar,
        Some("data:image/png;base64,abc".to_string())
    );
}

#[test]
fn identity_meta_default_optional_fields() {
    let json = r#"{"timestamp":100,"public_key":"pk","pseudo":"Bob"}"#;
    let meta: IdentityMeta = serde_json::from_str(json).unwrap();
    assert_eq!(meta.password_hash, "");
    assert_eq!(meta.avatar, None);
}

#[test]
fn identity_meta_explicit_null_avatar() {
    let json = r#"{"timestamp":1,"public_key":"k","pseudo":"X","password_hash":"","avatar":null}"#;
    let meta: IdentityMeta = serde_json::from_str(json).unwrap();
    assert_eq!(meta.avatar, None);
}

#[test]
fn identity_meta_unicode_pseudo() {
    let meta = IdentityMeta {
        timestamp: 0,
        public_key: "pk".into(),
        pseudo: "日本語テスト 🎮".into(),
        password_hash: String::new(),
        avatar: None,
    };
    let json = serde_json::to_string(&meta).unwrap();
    let decoded: IdentityMeta = serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.pseudo, "日本語テスト 🎮");
}

#[test]
fn identity_meta_empty_strings() {
    let meta = IdentityMeta {
        timestamp: 0,
        public_key: String::new(),
        pseudo: String::new(),
        password_hash: String::new(),
        avatar: Some(String::new()),
    };
    let json = serde_json::to_string(&meta).unwrap();
    let decoded: IdentityMeta = serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.public_key, "");
    assert_eq!(decoded.avatar, Some(String::new()));
}

#[test]
fn identity_meta_max_timestamp() {
    let meta = IdentityMeta {
        timestamp: u64::MAX,
        public_key: "pk".into(),
        pseudo: "T".into(),
        password_hash: String::new(),
        avatar: None,
    };
    let json = serde_json::to_string(&meta).unwrap();
    let decoded: IdentityMeta = serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.timestamp, u64::MAX);
}

// ──────────────── IdentityMetaPublic conversion ──────────────

#[test]
fn identity_meta_public_from_meta() {
    let meta = IdentityMeta {
        timestamp: 42,
        public_key: "pk1".to_string(),
        pseudo: "Eve".to_string(),
        password_hash: "secret-hash".to_string(),
        avatar: None,
    };
    let public = IdentityMetaPublic::from(&meta);
    assert_eq!(public.timestamp, 42);
    assert_eq!(public.public_key, "pk1");
    assert_eq!(public.pseudo, "Eve");
    assert_eq!(public.avatar, None);
}

#[test]
fn identity_meta_public_excludes_password_hash() {
    let meta = IdentityMeta {
        timestamp: 1,
        public_key: "pk2".to_string(),
        pseudo: "Zoe".to_string(),
        password_hash: "super-secret".to_string(),
        avatar: Some("av".to_string()),
    };
    let public = IdentityMetaPublic::from(&meta);
    let json = serde_json::to_string(&public).unwrap();
    // The JSON output must NOT contain the password hash
    assert!(!json.contains("super-secret"));
    assert!(!json.contains("password_hash"));
}

#[test]
fn identity_meta_public_with_avatar() {
    let meta = IdentityMeta {
        timestamp: 99,
        public_key: "pk3".to_string(),
        pseudo: "Max".to_string(),
        password_hash: String::new(),
        avatar: Some("https://img.com/max.png".to_string()),
    };
    let public = IdentityMetaPublic::from(&meta);
    assert_eq!(public.avatar, Some("https://img.com/max.png".to_string()));
}

#[test]
fn identity_meta_public_serialization_fields() {
    let meta = IdentityMeta {
        timestamp: 55,
        public_key: "pk-ser".into(),
        pseudo: "Tester".into(),
        password_hash: "h".into(),
        avatar: Some("av".into()),
    };
    let public = IdentityMetaPublic::from(&meta);
    let json = serde_json::to_string(&public).unwrap();
    assert!(json.contains("\"timestamp\":55"));
    assert!(json.contains("\"public_key\":\"pk-ser\""));
    assert!(json.contains("\"pseudo\":\"Tester\""));
    assert!(json.contains("\"avatar\":\"av\""));
}

#[test]
fn identity_meta_public_conversion_preserves_all_public_fields() {
    let meta = IdentityMeta {
        timestamp: 777,
        public_key: "long-key-value".into(),
        pseudo: "Name With Spaces".into(),
        password_hash: "ignored".into(),
        avatar: Some("data:image/jpeg;base64,/9j/4A".into()),
    };
    let public = IdentityMetaPublic::from(&meta);
    assert_eq!(public.timestamp, meta.timestamp);
    assert_eq!(public.public_key, meta.public_key);
    assert_eq!(public.pseudo, meta.pseudo);
    assert_eq!(public.avatar, meta.avatar);
}

#[test]
fn identity_meta_multiple_conversions_stable() {
    let meta = IdentityMeta {
        timestamp: 10,
        public_key: "pk".into(),
        pseudo: "A".into(),
        password_hash: "h".into(),
        avatar: None,
    };
    let p1 = IdentityMetaPublic::from(&meta);
    let p2 = IdentityMetaPublic::from(&meta);
    assert_eq!(p1.timestamp, p2.timestamp);
    assert_eq!(p1.public_key, p2.public_key);
    assert_eq!(p1.pseudo, p2.pseudo);
    assert_eq!(p1.avatar, p2.avatar);
}
