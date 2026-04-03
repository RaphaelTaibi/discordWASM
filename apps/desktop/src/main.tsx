import React from "react";
import ReactDOM from "react-dom/client";
import { debug, error, info, trace, warn } from '@tauri-apps/plugin-log';
import App from "./App";
import "./App.css"

// Capture les erreurs JavaScript globales dans le fichier log
window.addEventListener('error', (event) => {
  error(`Unhandled error: ${event.error?.stack || event.message}`);
});

window.addEventListener('unhandledrejection', (event) => {
  error(`Unhandled rejection: ${event.reason}`);
});

// Helper for safe serializing of logs (to prevent Circular Structure errors)
const safeFormat = (arg: any) => {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.stack || arg.message;
  try {
    const cache = new Set();
    return JSON.stringify(arg, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          return '[Circular]';
        }
        cache.add(value);
      }
      return value;
    });
  } catch (err) {
    return String(arg);
  }
};

// Alias console functions to Tauri log plugin
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalConsoleDebug = console.debug;
const originalConsoleTrace = console.trace;

console.log = (...args) => {
  info(args.map(safeFormat).join(' '));
  originalConsoleLog(...args);
};

console.info = (...args) => {
  info(args.map(safeFormat).join(' '));
  originalConsoleInfo(...args);
};

console.warn = (...args) => {
  warn(args.map(safeFormat).join(' '));
  originalConsoleWarn(...args);
};

console.error = (...args) => {
  error(args.map(safeFormat).join(' '));
  originalConsoleError(...args);
};

console.debug = (...args) => {
  debug(args.map(safeFormat).join(' '));
  originalConsoleDebug(...args);
};

console.trace = (...args) => {
  trace(args.map(safeFormat).join(' '));
  originalConsoleTrace(...args);
};

/**
 * The main application entry point.
 * Initializes React bindings onto the root element, wrapping the primary <App /> tree inside React Strict Mode.
 */
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
