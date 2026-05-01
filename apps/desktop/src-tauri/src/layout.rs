use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MARGIN_FRAC: f64 = 0.0;
const MIN_W_PX: f64 = 150.0;
const MIN_H_PX: f64 = 100.0;

/// Per-panel minimum sizes in pixels. Compact panels (bars) need smaller minimums.
fn min_sizes_for(id: &str) -> (f64, f64) {
    match id {
        "friends-bar" | "server-bar" => (48.0, 48.0),
        _ => (MIN_W_PX, MIN_H_PX),
    }
}

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutWindow {
    pub id: String,
    /// Horizontal position as fraction of container width (0.0–1.0)
    pub x: f64,
    /// Vertical position as fraction of container height (0.0–1.0)
    pub y: f64,
    /// Width as fraction of container width (0.0–1.0)
    pub w: f64,
    /// Height as fraction of container height (0.0–1.0)
    pub h: f64,
    pub z: i32,
}

#[derive(Default)]
pub struct LayoutState {
    pub windows: Mutex<HashMap<String, LayoutWindow>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MovePayload {
    pub id: String,
    pub dx: f64,
    pub dy: f64,
    pub container_w: f64,
    pub container_h: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ResizePayload {
    pub id: String,
    pub dw: f64,
    pub dh: f64,
    pub container_w: f64,
    pub container_h: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SwapPayload {
    pub id: String,
    pub container_w: f64,
    pub container_h: f64,
}

#[derive(Serialize, Clone)]
pub struct LayoutBatch {
    pub windows: Vec<LayoutWindow>,
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

fn get_layout_path(app: &tauri::AppHandle) -> PathBuf {
    let path = app
        .path()
        .app_config_dir()
        .expect("Failed to get app config dir");
    let _ = fs::create_dir_all(&path);
    path.join("layout.json")
}

fn sync_and_save(app: &tauri::AppHandle, windows: &HashMap<String, LayoutWindow>) {
    let batch = LayoutBatch {
        windows: windows.values().cloned().collect(),
    };
    let _ = app.emit("bento:layout:update", &batch);

    let app_clone = app.clone();
    let data_clone = windows.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        let path = get_layout_path(&app_clone);
        if let Ok(json) = serde_json::to_string_pretty(&data_clone) {
            let _ = fs::write(path, json);
        }
    });
}

pub fn load_layout_from_disk(app: &tauri::AppHandle) -> Option<HashMap<String, LayoutWindow>> {
    let path = get_layout_path(app);
    let data = fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

/// Provides sensible default panel positions as fractions of the container.
pub fn default_layout() -> HashMap<String, LayoutWindow> {
    let mut map = HashMap::new();
    map.insert(
        "sidebar".into(),
        LayoutWindow {
            id: "sidebar".into(),
            x: 0.0,
            y: 0.1161,
            w: 0.1559,
            h: 0.8839,
            z: 20,
        },
    );
    map.insert(
        "channel-panel".into(),
        LayoutWindow {
            id: "channel-panel".into(),
            x: 0.156,
            y: 0.1212,
            w: 0.6419,
            h: 0.8788,
            z: 10,
        },
    );
    map.insert(
        "chat-panel".into(),
        LayoutWindow {
            id: "chat-panel".into(),
            x: 0.7967,
            y: 0.117,
            w: 0.2033,
            h: 0.883,
            z: 30,
        },
    );
    map.insert(
        "friends-bar".into(),
        LayoutWindow {
            id: "friends-bar".into(),
            x: 0.4138,
            y: 0.005,
            w: 0.2188,
            h: 0.048,
            z: 25,
        },
    );
    map.insert(
        "server-bar".into(),
        LayoutWindow {
            id: "server-bar".into(),
            x: 0.0005,
            y: 0.0,
            w: 0.1133,
            h: 0.0698,
            z: 0,
        },
    );
    map
}

/// Detects legacy pixel-based layouts persisted before the fraction migration.
pub fn is_legacy_pixel_layout(map: &HashMap<String, LayoutWindow>) -> bool {
    map.values()
        .any(|w| w.x > 2.0 || w.y > 2.0 || w.w > 2.0 || w.h > 2.0)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

pub fn handle_move(
    state: &LayoutState,
    payload: MovePayload,
    app: &tauri::AppHandle,
) -> Result<(), String> {
    let mut windows = state.windows.lock().map_err(|_| "Mutex Poisoned")?;

    let win = windows.entry(payload.id.clone()).or_insert(LayoutWindow {
        id: payload.id.clone(),
        x: 0.05,
        y: 0.07,
        w: 0.17,
        h: 0.56,
        z: 0,
    });

    if payload.container_w > 0.0 && payload.container_h > 0.0 {
        win.x += payload.dx / payload.container_w;
        win.y += payload.dy / payload.container_h;
    }

    let max_x = (1.0 - win.w - MARGIN_FRAC).max(MARGIN_FRAC);
    let max_y = (1.0 - win.h - MARGIN_FRAC).max(MARGIN_FRAC);
    win.x = win.x.clamp(MARGIN_FRAC, max_x);
    win.y = win.y.clamp(MARGIN_FRAC, max_y);

    sync_and_save(app, &windows);
    Ok(())
}

pub fn handle_resize(
    state: &LayoutState,
    payload: ResizePayload,
    app: &tauri::AppHandle,
) -> Result<(), String> {
    let mut windows = state.windows.lock().map_err(|_| "Mutex Poisoned")?;

    let win = windows.entry(payload.id.clone()).or_insert(LayoutWindow {
        id: payload.id.clone(),
        x: 0.05,
        y: 0.07,
        w: 0.17,
        h: 0.56,
        z: 0,
    });

    if payload.container_w > 0.0 && payload.container_h > 0.0 {
        win.w += payload.dw / payload.container_w;
        win.h += payload.dh / payload.container_h;
    }

    let (mw_px, mh_px) = min_sizes_for(&payload.id);
    let min_w = if payload.container_w > 0.0 {
        mw_px / payload.container_w
    } else {
        0.03
    };
    let min_h = if payload.container_h > 0.0 {
        mh_px / payload.container_h
    } else {
        0.03
    };
    let max_w = (1.0 - win.x - MARGIN_FRAC).max(min_w);
    let max_h = (1.0 - win.y - MARGIN_FRAC).max(min_h);
    win.w = win.w.clamp(min_w, max_w);
    win.h = win.h.clamp(min_h, max_h);

    sync_and_save(app, &windows);
    Ok(())
}

/// Swaps width and height of a panel (pixel-aware fraction conversion).
pub fn handle_swap(
    state: &LayoutState,
    payload: SwapPayload,
    app: &tauri::AppHandle,
) -> Result<(), String> {
    let mut windows = state.windows.lock().map_err(|_| "Mutex Poisoned")?;

    let win = windows.get_mut(&payload.id).ok_or("Window not found")?;
    if payload.container_w <= 0.0 || payload.container_h <= 0.0 {
        return Ok(());
    }

    let w_px = win.w * payload.container_w;
    let h_px = win.h * payload.container_h;
    win.w = h_px / payload.container_w;
    win.h = w_px / payload.container_h;

    let (mw_px, mh_px) = min_sizes_for(&payload.id);
    let min_w = mw_px / payload.container_w;
    let min_h = mh_px / payload.container_h;
    let max_w = (1.0 - win.x - MARGIN_FRAC).max(min_w);
    let max_h = (1.0 - win.y - MARGIN_FRAC).max(min_h);
    win.w = win.w.clamp(min_w, max_w);
    win.h = win.h.clamp(min_h, max_h);

    sync_and_save(app, &windows);
    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn min_sizes_for_compact_bars() {
        assert_eq!(min_sizes_for("friends-bar"), (48.0, 48.0));
        assert_eq!(min_sizes_for("server-bar"), (48.0, 48.0));
    }

    #[test]
    fn min_sizes_for_default_panels() {
        assert_eq!(min_sizes_for("sidebar"), (MIN_W_PX, MIN_H_PX));
        assert_eq!(min_sizes_for("channel-panel"), (MIN_W_PX, MIN_H_PX));
        assert_eq!(min_sizes_for("unknown-widget"), (MIN_W_PX, MIN_H_PX));
    }

    #[test]
    fn default_layout_contains_all_panels() {
        let layout = default_layout();
        let expected = [
            "sidebar",
            "channel-panel",
            "chat-panel",
            "friends-bar",
            "server-bar",
        ];
        for id in &expected {
            assert!(layout.contains_key(*id), "missing panel: {id}");
        }
        assert_eq!(layout.len(), expected.len());
    }

    #[test]
    fn default_layout_fractions_in_range() {
        for (_, w) in default_layout() {
            assert!(w.x >= 0.0 && w.x <= 1.0, "{}: x={}", w.id, w.x);
            assert!(w.y >= 0.0 && w.y <= 1.0, "{}: y={}", w.id, w.y);
            assert!(w.w > 0.0 && w.w <= 1.0, "{}: w={}", w.id, w.w);
            assert!(w.h > 0.0 && w.h <= 1.0, "{}: h={}", w.id, w.h);
        }
    }

    #[test]
    fn default_layout_ids_match_keys() {
        for (key, w) in default_layout() {
            assert_eq!(key, w.id, "key/id mismatch for {key}");
        }
    }

    #[test]
    fn legacy_detection_pixel_values() {
        let mut map = HashMap::new();
        map.insert(
            "a".into(),
            LayoutWindow {
                id: "a".into(),
                x: 120.0,
                y: 80.0,
                w: 400.0,
                h: 300.0,
                z: 0,
            },
        );
        assert!(is_legacy_pixel_layout(&map));
    }

    #[test]
    fn legacy_detection_fraction_values() {
        let mut map = HashMap::new();
        map.insert(
            "a".into(),
            LayoutWindow {
                id: "a".into(),
                x: 0.1,
                y: 0.2,
                w: 0.5,
                h: 0.6,
                z: 0,
            },
        );
        assert!(!is_legacy_pixel_layout(&map));
    }

    #[test]
    fn legacy_detection_boundary_value() {
        let mut map = HashMap::new();
        map.insert(
            "a".into(),
            LayoutWindow {
                id: "a".into(),
                x: 2.0,
                y: 0.0,
                w: 0.5,
                h: 0.5,
                z: 0,
            },
        );
        assert!(
            !is_legacy_pixel_layout(&map),
            "2.0 is the boundary, not legacy"
        );
    }

    #[test]
    fn legacy_detection_just_above_boundary() {
        let mut map = HashMap::new();
        map.insert(
            "a".into(),
            LayoutWindow {
                id: "a".into(),
                x: 2.01,
                y: 0.0,
                w: 0.5,
                h: 0.5,
                z: 0,
            },
        );
        assert!(is_legacy_pixel_layout(&map));
    }

    #[test]
    fn legacy_detection_empty_map() {
        assert!(!is_legacy_pixel_layout(&HashMap::new()));
    }

    #[test]
    fn legacy_detection_mixed_panels() {
        let mut map = HashMap::new();
        map.insert(
            "a".into(),
            LayoutWindow {
                id: "a".into(),
                x: 0.1,
                y: 0.2,
                w: 0.3,
                h: 0.4,
                z: 0,
            },
        );
        map.insert(
            "b".into(),
            LayoutWindow {
                id: "b".into(),
                x: 500.0,
                y: 0.0,
                w: 0.3,
                h: 0.4,
                z: 0,
            },
        );
        assert!(
            is_legacy_pixel_layout(&map),
            "one pixel-based panel should flag the whole layout"
        );
    }
}
