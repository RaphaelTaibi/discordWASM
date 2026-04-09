import { useEffect, useCallback, useState } from "react";
import { useBentoLayoutContext } from "../context/BentoLayoutContext";
import { listen, emit } from "@tauri-apps/api/event";

/** Default layout positions as fractions (0.0–1.0). */
const DEFAULTS: Record<string, { x: number; y: number; w: number; h: number }> = {
  sidebar:         { x: 0.0,    y: 0.1161, w: 0.1559, h: 0.8839 },
  "channel-panel": { x: 0.156,  y: 0.1212, w: 0.6419, h: 0.8788 },
  "chat-panel":    { x: 0.7967, y: 0.117,  w: 0.2033, h: 0.883  },
  "friends-bar":   { x: 0.4138, y: 0.005,  w: 0.2188, h: 0.048  },
  "server-bar":    { x: 0.0005, y: 0.0,    w: 0.1133, h: 0.0698 },
};

/** Returns current bento container dimensions from the DOM. */
function getContainerSize() {
  const el = document.getElementById("bento-area");
  if (!el) return { container_w: window.innerWidth, container_h: window.innerHeight };
  const rect = el.getBoundingClientRect();
  return { container_w: Math.round(rect.width), container_h: Math.round(rect.height) };
}

/** Tracks the bento-area element size via ResizeObserver. */
function useContainerSize() {
  const [size, setSize] = useState(getContainerSize);

  useEffect(() => {
    const update = () => setSize(getContainerSize());
    const el = document.getElementById("bento-area");
    let observer: ResizeObserver | undefined;
    if (el) {
      observer = new ResizeObserver(update);
      observer.observe(el);
    }
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, []);

  return size;
}

export function useBentoLayout(windowId: string) {
  const { windows, updateBatch } = useBentoLayoutContext();
  const { container_w, container_h } = useContainerSize();

  useEffect(() => {
    let unlisten: any;

    const setupListener = async () => {
      unlisten = await listen("bento:layout:update", (event: any) => {
        const data = typeof event.payload === "string"
            ? JSON.parse(event.payload)
            : event.payload;

        updateBatch(data);
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [updateBatch]);

  const layout = windows.find(w => w.id === windowId);

  const emitMove = useCallback((delta: { dx: number; dy: number }) => {
    emit("bento:layout:move", { id: windowId, ...delta, ...getContainerSize() });
  }, [windowId]);

  const emitResize = useCallback((delta: { dw: number; dh: number }) => {
    emit("bento:layout:resize", { id: windowId, ...delta, ...getContainerSize() });
  }, [windowId]);

  /** Swaps width and height (pixel-aware) for orientation toggles. */
  const emitSwap = useCallback(() => {
    emit("bento:layout:swap", { id: windowId, ...getContainerSize() });
  }, [windowId]);

  const def = DEFAULTS[windowId] ?? { x: 0.05, y: 0.07, w: 0.17, h: 0.56 };
  const _frac = layout ?? def;

  return {
    x: Math.round(_frac.x * container_w),
    y: Math.round(_frac.y * container_h),
    w: Math.round(_frac.w * container_w),
    h: Math.round(_frac.h * container_h),
    onMove: emitMove,
    onResize: emitResize,
    onSwap: emitSwap,
  };
}