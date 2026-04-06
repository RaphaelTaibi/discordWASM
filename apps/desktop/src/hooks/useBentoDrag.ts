import { useCallback, useRef } from "react";

/**
 * Hook for drag interactions on Bento panels.
 * Uses requestAnimationFrame throttling to limit IPC event rate.
 * @param onMove - Callback emitting delta to Tauri (dx, dy)
 * @returns handleDragStart to bind on a drag handle's onMouseDown
 */
export function useBentoDrag(onMove: (delta: { dx: number; dy: number }) => void) {
    const rafRef = useRef<number | null>(null);

    const handleDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        let lastX = e.clientX;
        let lastY = e.clientY;
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (rafRef.current) return;
            rafRef.current = requestAnimationFrame(() => {
                const dx = moveEvent.clientX - lastX;
                const dy = moveEvent.clientY - lastY;
                lastX = moveEvent.clientX;
                lastY = moveEvent.clientY;
                if (dx !== 0 || dy !== 0) onMove({ dx, dy });
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
    }, [onMove]);

    return handleDragStart;
}

