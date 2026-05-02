// Copyright (c) 2025 Raphael Taibi. All rights reserved.
// Licensed under the Business Source License 1.1 (BUSL-1.1).
// Use of this source code is governed by the LICENSE file at the
// repository root. Change Date: 2031-04-07. Change License:
// GPL-3.0-or-later.
// SPDX-License-Identifier: BUSL-1.1

/**
 * Patches `app.security.csp` in `src-tauri/tauri.conf.json` by computing
 * the `connect-src` allowlist from environment variables. This keeps any
 * production host (Oracle VM IP, custom TURN, ...) out of version control:
 * the source of truth lives in `.env.*` files locally and in CI secrets
 * (`VITE_SIGNALING_URL`, `VITE_API_URL`, `VITE_TURN_URL`).
 *
 * Behavior: always preserves the Tauri IPC schemes and the GitHub
 * updater endpoint; appends every distinct WS/HTTP origin derived from
 * the env URLs. Idempotent — safe to re-run on every install/build.
 *
 * Run via `pnpm csp:inject` (also wired as a `postinstall` hook).
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONF_PATH = resolve(__dirname, "..", "src-tauri", "tauri.conf.json");

/**
 * Default origins always allowed:
 * - `'self'`            → app shell.
 * - `github.com`        → updater (GitHub Releases JSON + binaries).
 * - `ipc:` / `http(s)://ipc.localhost` / `tauri://localhost` → Tauri v2 IPC
 *   custom protocols. The webview MUST be allowed to fetch these schemes,
 *   otherwise EVERY `invoke()` call is blocked by CSP and the app silently
 *   loses access to native commands (identity restore, updater check, etc.).
 *   Symptom: user is dropped on the login screen with `find_identity_by_pubkey`
 *   refused, then auto-login fails and voice channels show the user alone.
 *
 * Note: no `localhost:8080` here — production never targets a local
 * signaling server. Dev builds inject `VITE_SIGNALING_URL` directly.
 */
const STATIC_ORIGINS = [
    "'self'",
    "ipc:",
    "http://ipc.localhost",
    "https://ipc.localhost",
    "tauri://localhost",
    "https://tauri.localhost",
    "https://github.com",
];

/** Loads .env files if dotenv-style key=value (no dependency). */
function loadDotEnv(file) {
    if (!existsSync(file)) return;
    const _content = readFileSync(file, "utf8");
    for (const _line of _content.split(/\r?\n/)) {
        const _trim = _line.trim();
        if (!_trim || _trim.startsWith("#")) continue;
        const _eq = _trim.indexOf("=");
        if (_eq <= 0) continue;
        const _key = _trim.slice(0, _eq).trim();
        const _val = _trim.slice(_eq + 1).trim().replace(/^['"]|['"]$/g, "");
        if (process.env[_key] === undefined) process.env[_key] = _val;
    }
}

// CI provides env directly; local dev gets it from .env files.
loadDotEnv(resolve(__dirname, "..", ".env"));
loadDotEnv(resolve(__dirname, "..", ".env.production"));

/**
 * Production fallback origins. Mirrored from `src/lib/config.ts` so the
 * webview CSP keeps allowing the live signaling host even when the build
 * environment did not export `VITE_SIGNALING_URL` / `VITE_API_URL`.
 * Keep this list in sync with `PROD_WS` / `PROD_API` in `config.ts`.
 */
const PROD_FALLBACK_URLS = [
    "wss://89.168.59.45:3001/ws",
    "https://89.168.59.45:3001",
];

/**
 * Extracts a CSP-compatible origin from a URL-like value.
 * - `wss://host:port/path` → `wss://host:port`
 * - `turn:host:port`       → ignored (CSP `connect-src` does not cover TURN)
 * Returns null when parsing fails (safe no-op).
 */
function originFromUrl(_url) {
    if (!_url) return null;
    try {
        const _u = new URL(_url);
        if (!["ws:", "wss:", "http:", "https:"].includes(_u.protocol)) return null;
        return `${_u.protocol}//${_u.host}`;
    } catch {
        return null;
    }
}

/** Mirrors a ws(s) origin into its http(s) twin (and vice versa). */
function expandSiblings(_origin) {
    const _out = new Set([_origin]);
    if (_origin.startsWith("wss://")) _out.add(_origin.replace("wss://", "https://"));
    else if (_origin.startsWith("ws://")) _out.add(_origin.replace("ws://", "http://"));
    else if (_origin.startsWith("https://")) _out.add(_origin.replace("https://", "wss://"));
    else if (_origin.startsWith("http://")) _out.add(_origin.replace("http://", "ws://"));
    return [..._out];
}

const _envOrigins = [
    process.env.VITE_SIGNALING_URL,
    process.env.VITE_API_URL,
    process.env.VITE_TURN_HTTP_URL, // optional HTTP control plane in front of TURN
    ...PROD_FALLBACK_URLS,
]
    .map(originFromUrl)
    .filter(Boolean)
    .flatMap(expandSiblings);

const _connectSrc = Array.from(new Set([...STATIC_ORIGINS, ..._envOrigins]));

const _csp = [
    `default-src 'self'`,
    `connect-src ${_connectSrc.join(" ")}`,
    `script-src 'self' 'wasm-unsafe-eval'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
].join("; ");

const _conf = JSON.parse(readFileSync(CONF_PATH, "utf8"));
_conf.app ??= {};
_conf.app.security ??= {};
_conf.app.security.csp = _csp;
writeFileSync(CONF_PATH, JSON.stringify(_conf, null, 2) + "\n", "utf8");

console.log(`[inject-csp] connect-src = ${_connectSrc.join(" ")}`);

