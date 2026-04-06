import { useCallback, useRef } from "react";

type ResizeDirection = "right" | "bottom" | "corner";

const CURSOR_MAP: Record<ResizeDirection, string> = {
    right: "col-resize",
    bottom: "row-resize",
    corner: "nwse-resize",
};

/**
 * Hook for resize interactions on Bento panels.
 * Uses requestAnimationFrame throttling to limit IPC event rate.
 * @param onResize - Callback emitting delta to Tauri (dw, dh)
 * @param direction - Resize direction for cursor styling
 * @returns handleResizeStart to bind on a resize handle's onMouseDown
 */
export function useBentoResize(
    onResize: (delta: { dw: number; dh: number }) => void,
    direction: ResizeDirection = "corner"
) {
    const rafRef = useRef<number | null>(null);

    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        let lastX = e.clientX;
        let lastY = e.clientY;
        document.body.style.cursor = CURSOR_MAP[direction];
        document.body.style.userSelect = "none";

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (rafRef.current) return;
            rafRef.current = requestAnimationFrame(() => {
                const dw = moveEvent.clientX - lastX;
                const dh = moveEvent.clientY - lastY;
                lastX = moveEvent.clientX;
                lastY = moveEvent.clientY;
                if (dw !== 0 || dh !== 0) onResize({ dw, dh });
                rafRef.current = null;
            });
        };

        const onMouseUp = () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    }, [onResize, direction]);

    return handleResizeStart;
}

