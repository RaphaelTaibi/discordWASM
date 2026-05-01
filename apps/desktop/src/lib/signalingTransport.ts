import { subscribeSignalingEvent } from './signalingBus';

/**
 * Transport-agnostic signaling sender. Set once by the WS owner
 * (typically `VoiceContext`) at connection time so any feature module
 * can publish messages without depending on React context.
 */
type SendFn = (payload: unknown) => Promise<void> | void;

let _send: SendFn | null = null;

// ---------------------------------------------------------------------------
// Auth gate: features that need an authenticated WS (RPC, subscriptions to
// authorised resources) await this before issuing requests, sidestepping the
// REST→WS cold-start race condition.
// ---------------------------------------------------------------------------

let _authResolve: (() => void) | null = null;
let _authPromise: Promise<void> = new Promise<void>((resolve) => {
    _authResolve = resolve;
});
let _isAuthenticated = false;

subscribeSignalingEvent('authenticated', (e) => {
    if (e.ok) {
        _isAuthenticated = true;
        _authResolve?.();
    }
});

/** Resolves as soon as the server has acknowledged authentication. */
export const whenAuthenticated = (): Promise<void> => _authPromise;

/** Resets the auth gate on disconnect so the next reconnection re-arms it. */
const _resetAuthGate = (): void => {
    _isAuthenticated = false;
    _authPromise = new Promise<void>((resolve) => {
        _authResolve = resolve;
    });
};

/** Installs the live send function. Pass `null` on disconnect. */
export const setSignalingSender = (fn: SendFn | null): void => {
    _send = fn;
    if (fn === null) _resetAuthGate();
};

/** Returns the current sender, or `null` if the WS is not yet connected. */
export const getSignalingSender = (): SendFn | null => _send;

/**
 * Sends a raw signaling payload. No-ops if the transport is offline.
 * Prefer feature-specific helpers ({@link rpc}, `subscribeChannel`, …) over
 * direct calls to this in business code.
 */
export const sendSignalingMessage = async (payload: unknown): Promise<void> => {
    if (_send) await _send(payload);
};

// ---------------------------------------------------------------------------
// RPC (request/response) helper — correlates by `requestId`.
// ---------------------------------------------------------------------------

interface PendingRpc {
    resolve: (value: unknown) => void;
    reject: (reason: { code: string; message: string }) => void;
    timer: ReturnType<typeof setTimeout>;
}

const _pending = new Map<string, PendingRpc>();
const RPC_TIMEOUT_MS = 10_000;

// Single global subscription that fans replies out to pending callers.
subscribeSignalingEvent('rpc-result', ({ requestId, result, error }) => {
    const _entry = _pending.get(requestId);
    if (!_entry) return;
    clearTimeout(_entry.timer);
    _pending.delete(requestId);
    if (error) _entry.reject(error);
    else _entry.resolve(result ?? null);
});

const _genId = (): string => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `rpc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Issues a typed RPC over the signaling WS and resolves with the server's
 * `result` payload or rejects with `{ code, message }`.
 *
 * @param method Server-side method name (e.g. `friends.list`).
 * @param params JSON params object (default: `{}`).
 * @returns The decoded `result` field of the RpcResult message.
 */
export const rpc = async <T = unknown>(method: string, params: object = {}): Promise<T> => {
    // Block until the WS is authenticated. This sidesteps the cold-start race
    // where features (friends list, server members) issue calls before the
    // VoiceContext has opened the socket and exchanged the JWT.
    if (!_isAuthenticated) {
        await _authPromise;
    }
    if (!_send) {
        throw { code: 'offline', message: 'Signaling WS not connected' };
    }
    const requestId = _genId();
    return new Promise<T>((resolve, reject) => {
        const _timer = setTimeout(() => {
            _pending.delete(requestId);
            reject({ code: 'timeout', message: `RPC '${method}' timed out` });
        }, RPC_TIMEOUT_MS);
        _pending.set(requestId, {
            resolve: (v) => resolve(v as T),
            reject,
            timer: _timer,
        });
        Promise.resolve(_send!({ type: 'rpc', requestId, method, params })).catch((e) => {
            clearTimeout(_timer);
            _pending.delete(requestId);
            reject({ code: 'send-failed', message: String(e) });
        });
    });
};

/** Authenticates the WS with the supplied JWT. Server replies with `authenticated`. */
export const authenticateSignaling = (token: string): Promise<void> => sendSignalingMessage({ type: 'authenticate', token }) as Promise<void>;

/** Subscribes the WS to chat push events for a text channel. */
export const subscribeChannel = (channelId: string): Promise<void> => sendSignalingMessage({ type: 'subscribe-channel', channelId }) as Promise<void>;

export const unsubscribeChannel = (channelId: string): Promise<void> => sendSignalingMessage({ type: 'unsubscribe-channel', channelId }) as Promise<void>;

/** Subscribes the WS to server presence and membership events. */
export const subscribeServer = (serverId: string): Promise<void> => sendSignalingMessage({ type: 'subscribe-server', serverId }) as Promise<void>;

export const unsubscribeServer = (serverId: string): Promise<void> => sendSignalingMessage({ type: 'unsubscribe-server', serverId }) as Promise<void>;



