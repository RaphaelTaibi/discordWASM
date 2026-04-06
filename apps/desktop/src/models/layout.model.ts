/**
 * Layout model for Bento Tactile system.
 * Represents the position and size of a window/panel.
 * @see Used for communication between React and Rust (Tauri)
 */
export interface LayoutWindow {
  /** Unique identifier for the window/panel */
  id: string;
  /** X coordinate (pixels) */
  x: number;
  /** Y coordinate (pixels) */
  y: number;
  /** Width (pixels) */
  w: number;
  /** Height (pixels) */
  h: number;
  /** Optional: z-index for stacking order */
  z?: number;
}

/**
 * Batch update sent by Rust to React.
 * @property windows Array of updated window layouts
 */
export interface LayoutBatchUpdate {
  windows: LayoutWindow[];
}

/**
 * Context value for BentoLayout state management.
 */
export interface BentoLayoutContextValue {
  windows: LayoutWindow[];
  setWindows: (windows: LayoutWindow[]) => void;
  updateBatch: (batch: LayoutBatchUpdate) => void;
}

