import { useEffect, useCallback } from "react";
import { useBentoLayoutContext } from "../context/BentoLayoutContext";
import { listen, emit } from "@tauri-apps/api/event";

/** Default layout positions for each known panel. */
const DEFAULTS: Record<string, { x: number; y: number; w: number; h: number }> = {
  sidebar: { x: 8, y: 48, w: 260, h: 600 },
  "channel-panel": { x: 280, y: 48, w: 500, h: 600 },
  "chat-panel": { x: 280, y: 48, w: 500, h: 600 },
};

/** Returns current bento container dimensions from the DOM. */
function getContainerSize() {
  const el = document.getElementById("bento-area");
  if (!el) return { container_w: window.innerWidth, container_h: window.innerHeight };
  const rect = el.getBoundingClientRect();
  return { container_w: Math.round(rect.width), container_h: Math.round(rect.height) };
}

export function useBentoLayout(windowId: string) {
  const { windows, updateBatch } = useBentoLayoutContext();

  // 1. ÉCOUTER les mises à jour de Rust
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

  // 2. TROUVER les données de cette fenêtre
  const layout = windows.find(w => w.id === windowId);

  // 3. EMETTRE le mouvement vers Rust
  const emitMove = useCallback((delta: { dx: number; dy: number }) => {
    emit("bento:layout:move", { id: windowId, ...delta, ...getContainerSize() });
  }, [windowId]);

  // 4. EMETTRE le resize vers Rust
  const emitResize = useCallback((delta: { dw: number; dh: number }) => {
    emit("bento:layout:resize", { id: windowId, ...delta, ...getContainerSize() });
  }, [windowId]);

  const def = DEFAULTS[windowId] ?? { x: 100, y: 100, w: 240, h: 500 };

  return {
    x: layout?.x ?? def.x,
    y: layout?.y ?? def.y,
    w: layout?.w ?? def.w,
    h: layout?.h ?? def.h,
    onMove: emitMove,
    onResize: emitResize,
  };
}