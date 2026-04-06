import React from "react";

/**
 * Visual resize handle for Bento panels (bottom-right corner).
 * @param onMouseDown - Handler from useBentoResize
 */
const ResizeHandle: React.FC<{ onMouseDown: (e: React.MouseEvent) => void }> = ({ onMouseDown }) => (
    <div
        onMouseDown={onMouseDown}
        className="absolute right-0 bottom-0 w-4 h-4 z-30 cursor-nwse-resize flex items-end justify-end"
        style={{ touchAction: "none" }}
    >
        <div className="w-3 h-3 bg-cyan-400/30 hover:bg-cyan-400/60 rounded-br-2xl transition-colors" />
    </div>
);

export default ResizeHandle;

