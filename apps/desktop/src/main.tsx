import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css"

/**
 * The main application entry point.
 * Initializes React bindings onto the root element, wrapping the primary <App /> tree inside React Strict Mode.
 */
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
