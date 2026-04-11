import { config } from '../lib/config';

let _token: string | null = null;

/** @returns The current JWT or null. */
export const getToken = (): string | null => _token;

/** Stores a JWT in memory (never persisted to Web Storage). */
export const setToken = (token: string): void => { _token = token; };

/** Clears the in-memory JWT. */
export const clearToken = (): void => { _token = null; };

/**
 * Thin wrapper around fetch that auto-attaches the JWT
 * and targets the signaling server API base URL.
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

    const res = await fetch(`${config.apiUrl}${path}`, { ...options, headers });

    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return res.json();
}

/**
 * Binary fetch for protobuf content negotiation.
 * Sends `application/x-protobuf` when a body is present and
 * requests the same format via the Accept header.
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

    const res = await fetch(`${config.apiUrl}${path}`, { ...options, headers });

    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
}

