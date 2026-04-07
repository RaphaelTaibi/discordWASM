import { config } from '../lib/config';

const TOKEN_KEY = 'auth_token';

/** @returns The stored JWT or null. */
export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

/** Stores a JWT in localStorage. */
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);

/** Removes the stored JWT. */
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

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

