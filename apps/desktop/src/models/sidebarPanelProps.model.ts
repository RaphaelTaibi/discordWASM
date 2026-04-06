import React from "react";

/**
 * Interface for SidebarPanel props (Discord-like floating sidebar)
 * Toute la gestion de position/taille doit venir du backend (Tauri/Rust) via props.
 */
export default interface SidebarPanelProps {
  x: number;
  y: number;
  w: number;
  h: number;
  onMove: (dx: number, dy: number) => void;
  onResize?: (dw: number, dh: number) => void;
  sidebar: React.ReactNode;
  sidebarFooter?: React.ReactNode;
}

