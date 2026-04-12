import { invoke } from '@tauri-apps/api/core';
import { config } from '../lib/config';

let _token: string | null = null;

/** @returns The current JWT or null. */
export const getToken = (): string | null => _token;

/** Stores a JWT in memory (never persisted to Web Storage). */
export const setToken = (token: string): void => { _token = token; };

/** Clears the in-memory JWT. */
export const clearToken = (): void => { _token = null; };

/**
 * Routes an HTTP request through Tauri's cert-pinned reqwest client.
 * Bypasses the webview fetch which rejects self-signed certificates.
 */
async function nativeFetch(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: Uint8Array | string,
): Promise<{ status: number; body: Uint8Array }> {
    let _bodyBytes: number[] | undefined;
    if (body instanceof Uint8Array) {
        _bodyBytes = Array.from(body);
    } else if (typeof body === 'string') {
        _bodyBytes = Array.from(new TextEncoder().encode(body));
    }

    const res = await invoke<{ status: number; body: number[] }>('http_fetch', {
        request: { method, url, headers, body: _bodyBytes },
    });

    return { status: res.status, body: new Uint8Array(res.body) };
}

/**
 * JSON API call routed through the native TLS client.
 * @param path - Relative path (e.g. `/api/auth/login`).
 * @param options - Standard RequestInit overrides.
 * @returns Parsed JSON response.
 * @throws {Error} On non-ok responses with the server error message.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> ?? {}),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const _body = typeof options.body === 'string' ? options.body : undefined;
    const res = await nativeFetch(`${config.apiUrl}${path}`, options.method ?? 'GET', headers, _body);

    if (res.status < 200 || res.status >= 300) {
        const _text = new TextDecoder().decode(res.body);
        let _msg: string;
        try { _msg = JSON.parse(_text).error ?? `HTTP ${res.status}`; }
        catch { _msg = `HTTP ${res.status}`; }
        throw new Error(_msg);
    }

    return JSON.parse(new TextDecoder().decode(res.body));
}

/**
 * Binary fetch for protobuf content negotiation, routed through native TLS.
 * @param path - Relative API path.
 * @param options - Standard RequestInit; `body` should be a Uint8Array.
 * @returns Raw response bytes for WASM protobuf decoding.
 */
export async function apiFetchProto(
    path: string,
    options: RequestInit = {},
): Promise<Uint8Array> {
    const token = getToken();
    const headers: Record<string, string> = {
        'Accept': 'application/x-protobuf',
        ...(options.headers as Record<string, string> ?? {}),
    };
    if (options.body instanceof Uint8Array) {
        headers['Content-Type'] = 'application/x-protobuf';
    }
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const _body = options.body instanceof Uint8Array ? options.body : undefined;
    const res = await nativeFetch(`${config.apiUrl}${path}`, options.method ?? 'GET', headers, _body);

    if (res.status < 200 || res.status >= 300) {
        const _text = new TextDecoder().decode(res.body);
        let _msg: string;
        try { _msg = JSON.parse(_text).error ?? `HTTP ${res.status}`; }
        catch { _msg = `HTTP ${res.status}`; }
        throw new Error(_msg);
    }

    return res.body;
}

