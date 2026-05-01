use crate::auth::password::{hash_password, verify_password};

// ---------------------------------------------------------------------------
// 1. Round-trip: hash → verify succeeds
// ---------------------------------------------------------------------------

#[test]
fn hash_then_verify() {
    let pw = "SecureP@ss123";
    let hash = hash_password(pw).expect("hash");
    assert!(verify_password(pw, &hash));
}

// ---------------------------------------------------------------------------
// 2. Wrong password fails verification
// ---------------------------------------------------------------------------

#[test]
fn wrong_password_fails() {
    let hash = hash_password("correct").expect("hash");
    assert!(!verify_password("wrong", &hash));
}

// ---------------------------------------------------------------------------
// 3. Different passwords produce different hashes (salt randomness)
// ---------------------------------------------------------------------------

#[test]
fn different_passwords_different_hashes() {
    let h1 = hash_password("alpha").expect("hash1");
    let h2 = hash_password("beta").expect("hash2");
    assert_ne!(h1, h2);
}

// ---------------------------------------------------------------------------
// 4. Same password hashed twice yields different hashes (unique salt)
// ---------------------------------------------------------------------------

#[test]
fn same_password_different_salts() {
    let pw = "SamePass";
    let h1 = hash_password(pw).expect("hash1");
    let h2 = hash_password(pw).expect("hash2");
    assert_ne!(h1, h2);
    assert!(verify_password(pw, &h1));
    assert!(verify_password(pw, &h2));
}

// ---------------------------------------------------------------------------
// 5. Invalid stored hash returns false (no panic)
// ---------------------------------------------------------------------------

#[test]
fn invalid_hash_returns_false() {
    assert!(!verify_password("anything", "not-a-valid-hash"));
}

// ---------------------------------------------------------------------------
// 6. Empty password can be hashed and verified
// ---------------------------------------------------------------------------

#[test]
fn empty_password_roundtrip() {
    let hash = hash_password("").expect("hash");
    assert!(verify_password("", &hash));
    assert!(!verify_password("non-empty", &hash));
}
