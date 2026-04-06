import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css"

const isTauri = !!(window as any).__TAURI_INTERNALS__;

if (isTauri) {
  import('@tauri-apps/plugin-log').then(({ debug, error, info, trace, warn }) => {
    // Capture global JS errors into Tauri log file
    window.addEventListener('error', (event) => {
      error(`Unhandled error: ${event.error?.stack || event.message}`);
    });

    window.addEventListener('unhandledrejection', (event) => {
      error(`Unhandled rejection: ${event.reason}`);
    });

    const safeFormat = (arg: any) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.stack || arg.message;
      try {
        const cache = new Set();
        return JSON.stringify(arg, (_key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) return '[Circular]';
            cache.add(value);
          }
          return value;
        });
      } catch {
        return String(arg);
      }
    };

    const originalLog = console.log;
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalDebug = console.debug;
    const originalTrace = console.trace;

    console.log = (...args) => { info(args.map(safeFormat).join(' ')); originalLog(...args); };
    console.info = (...args) => { info(args.map(safeFormat).join(' ')); originalInfo(...args); };
    console.warn = (...args) => { warn(args.map(safeFormat).join(' ')); originalWarn(...args); };
    console.error = (...args) => { error(args.map(safeFormat).join(' ')); originalError(...args); };
    console.debug = (...args) => { debug(args.map(safeFormat).join(' ')); originalDebug(...args); };
    console.trace = (...args) => { trace(args.map(safeFormat).join(' ')); originalTrace(...args); };
  });
}

/**
 * The main application entry point.
 * Initializes React bindings onto the root element, wrapping the primary <App /> tree inside React Strict Mode.
 */
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
