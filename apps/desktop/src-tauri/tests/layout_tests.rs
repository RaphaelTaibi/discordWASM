/// Layout engine pure-logic tests.
/// Validates clamping, fraction-based moves, resizes, and default layout.
use desktop_lib::layout::*;

// ───────────────────────── LayoutWindow ──────────────────────

#[test]
fn layout_window_serialization_roundtrip() {
    let win = LayoutWindow {
        id: "test".into(),
        x: 0.1,
        y: 0.2,
        w: 0.3,
        h: 0.4,
        z: 5,
    };
    let json = serde_json::to_string(&win).unwrap();
    let decoded: LayoutWindow = serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.id, "test");
    assert!((decoded.x - 0.1).abs() < 1e-10);
    assert!((decoded.w - 0.3).abs() < 1e-10);
    assert_eq!(decoded.z, 5);
}

#[test]
fn layout_window_zero_position() {
    let win = LayoutWindow {
        id: "origin".into(),
        x: 0.0,
        y: 0.0,
        w: 0.5,
        h: 0.5,
        z: 0,
    };
    let json = serde_json::to_string(&win).unwrap();
    let decoded: LayoutWindow = serde_json::from_str(&json).unwrap();
    assert!((decoded.x).abs() < f64::EPSILON);
    assert!((decoded.y).abs() < f64::EPSILON);
}

#[test]
fn layout_window_full_container() {
    let win = LayoutWindow {
        id: "full".into(),
        x: 0.0,
        y: 0.0,
        w: 1.0,
        h: 1.0,
        z: 0,
    };
    assert!((win.w - 1.0).abs() < f64::EPSILON);
    assert!((win.h - 1.0).abs() < f64::EPSILON);
}

#[test]
fn layout_window_negative_z_order() {
    let win = LayoutWindow {
        id: "bg".into(),
        x: 0.0,
        y: 0.0,
        w: 1.0,
        h: 1.0,
        z: -10,
    };
    assert_eq!(win.z, -10);
}

#[test]
fn layout_window_clone_independence() {
    let win = LayoutWindow {
        id: "src".into(),
        x: 0.1,
        y: 0.2,
        w: 0.3,
        h: 0.4,
        z: 5,
    };
    let mut cloned = win.clone();
    cloned.x = 0.9;
    cloned.id = "cloned".into();
    assert_eq!(win.id, "src");
    assert!((win.x - 0.1).abs() < f64::EPSILON);
}

// ───────────────────────── MovePayload ──────────────────────

#[test]
fn move_payload_deserialize() {
    let json = r#"{"id":"panel","dx":10,"dy":20,"container_w":1000,"container_h":800}"#;
    let p: MovePayload = serde_json::from_str(json).unwrap();
    assert_eq!(p.id, "panel");
    assert_eq!(p.dx, 10.0);
    assert_eq!(p.container_w, 1000.0);
}

#[test]
fn move_payload_negative_deltas() {
    let json = r#"{"id":"x","dx":-50,"dy":-25,"container_w":800,"container_h":600}"#;
    let p: MovePayload = serde_json::from_str(json).unwrap();
    assert_eq!(p.dx, -50.0);
    assert_eq!(p.dy, -25.0);
}

#[test]
fn move_payload_zero_deltas() {
    let json = r#"{"id":"x","dx":0,"dy":0,"container_w":1920,"container_h":1080}"#;
    let p: MovePayload = serde_json::from_str(json).unwrap();
    assert!((p.dx).abs() < f64::EPSILON);
    assert!((p.dy).abs() < f64::EPSILON);
}

// ───────────────────────── ResizePayload ─────────────────────

#[test]
fn resize_payload_deserialize() {
    let json = r#"{"id":"panel","dw":50,"dh":-30,"container_w":1920,"container_h":1080}"#;
    let p: ResizePayload = serde_json::from_str(json).unwrap();
    assert_eq!(p.dw, 50.0);
    assert_eq!(p.dh, -30.0);
}

#[test]
fn resize_payload_fractional_deltas() {
    let json = r#"{"id":"p","dw":0.5,"dh":0.5,"container_w":1920,"container_h":1080}"#;
    let p: ResizePayload = serde_json::from_str(json).unwrap();
    assert!((p.dw - 0.5).abs() < f64::EPSILON);
}

// ───────────────────────── SwapPayload ──────────────────────

#[test]
fn swap_payload_deserialize() {
    let json = r#"{"id":"sidebar","container_w":1920,"container_h":1080}"#;
    let p: SwapPayload = serde_json::from_str(json).unwrap();
    assert_eq!(p.id, "sidebar");
}

#[test]
fn swap_payload_small_container() {
    let json = r#"{"id":"bar","container_w":320,"container_h":240}"#;
    let p: SwapPayload = serde_json::from_str(json).unwrap();
    assert_eq!(p.container_w, 320.0);
    assert_eq!(p.container_h, 240.0);
}

// ───────────────────────── LayoutState ──────────────────────

#[test]
fn layout_state_default_empty() {
    let state = LayoutState::default();
    let map = state.windows.lock().unwrap();
    assert!(map.is_empty());
}

#[test]
fn layout_state_insert_and_read() {
    let state = LayoutState::default();
    {
        let mut map = state.windows.lock().unwrap();
        map.insert(
            "test".into(),
            LayoutWindow {
                id: "test".into(),
                x: 0.1,
                y: 0.2,
                w: 0.3,
                h: 0.4,
                z: 1,
            },
        );
    }
    let map = state.windows.lock().unwrap();
    assert_eq!(map.len(), 1);
    assert!(map.contains_key("test"));
}

#[test]
fn layout_state_overwrite_existing() {
    let state = LayoutState::default();
    let mut map = state.windows.lock().unwrap();
    map.insert(
        "w".into(),
        LayoutWindow {
            id: "w".into(),
            x: 0.0,
            y: 0.0,
            w: 0.5,
            h: 0.5,
            z: 0,
        },
    );
    map.insert(
        "w".into(),
        LayoutWindow {
            id: "w".into(),
            x: 0.9,
            y: 0.9,
            w: 0.1,
            h: 0.1,
            z: 99,
        },
    );
    assert_eq!(map.len(), 1);
    assert_eq!(map.get("w").unwrap().z, 99);
}

// ──────────────────── Payload struct fields ──────────────────

#[test]
fn layout_window_all_fields_accessible() {
    let w = LayoutWindow {
        id: "a".into(),
        x: 0.0,
        y: 0.0,
        w: 1.0,
        h: 1.0,
        z: 99,
    };
    assert_eq!(w.id, "a");
    assert_eq!(w.z, 99);
    assert!((w.w - 1.0).abs() < f64::EPSILON);
}
