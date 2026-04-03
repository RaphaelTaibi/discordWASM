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

// Alias console functions to Tauri log plugin
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalConsoleDebug = console.debug;
const originalConsoleTrace = console.trace;

console.log = (...args) => {
  info(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
  originalConsoleLog(...args);
};

console.info = (...args) => {
  info(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
  originalConsoleInfo(...args);
};

console.warn = (...args) => {
  warn(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
  originalConsoleWarn(...args);
};

console.error = (...args) => {
  error(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
  originalConsoleError(...args);
};

console.debug = (...args) => {
  debug(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
  originalConsoleDebug(...args);
};

console.trace = (...args) => {
  trace(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
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
