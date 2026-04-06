/**
 * SidebarPanel is the floating/drag-resizable sidebar (Discord-like).
 * Position/size driven by Tauri/Rust via props.
 */
import React from "react";
import SidebarPanelProps from "../../models/sidebarPanelProps.model";
import { useBentoDrag } from "../../hooks/useBentoDrag";
import { useBentoResize } from "../../hooks/useBentoResize";
import ResizeHandle from "./ResizeHandle";

const SidebarPanel: React.FC<SidebarPanelProps> = ({
  x,
  y,
  w,
  h,
  onMove,
  onResize,
  sidebar,
  sidebarFooter,
}) => {
  const handleDragStart = useBentoDrag(({ dx, dy }) => onMove(dx, dy));
  const handleResizeStart = useBentoResize(
    ({ dw, dh }) => onResize?.(dw, dh),
    "corner"
  );

  return (
    <div
      className="absolute z-20"
      style={{ left: x, top: y, width: w, height: h }}
    >
      <aside className="relative h-full w-full glass-heavy flex flex-col rounded-2xl border border-white/[0.06] overflow-hidden shadow-2xl">
        {/* Drag Handle */}
        <div
          onMouseDown={handleDragStart}
          className="shrink-0 h-8 cursor-grab active:cursor-grabbing flex items-center justify-center hover:bg-white/[0.05]"
        >
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">{sidebar}</div>

        {/* Footer */}
        {sidebarFooter && (
          <div className="shrink-0 border-t border-white/[0.06]">
            {sidebarFooter}
          </div>
        )}

        {/* Resize Handle */}
        <ResizeHandle onMouseDown={handleResizeStart} />
      </aside>
    </div>
  );
};

export default SidebarPanel;

