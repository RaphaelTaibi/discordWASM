import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { apiFetch, apiFetchProto, getToken, setToken, clearToken } from '../../api/http-client';
import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

/** Helper: builds a proxy response with JSON body. */
function jsonResponse(data: unknown, status = 200) {
    return { status, body: Array.from(new TextEncoder().encode(JSON.stringify(data))) };
}

beforeEach(() => {
    mockInvoke.mockReset();
    clearToken();
});

describe('token helpers', () => {
    it('getToken returns null when empty', () => {
        expect(getToken()).toBeNull();
    });

    it('setToken / getToken round-trips', () => {
        setToken('my-jwt');
        expect(getToken()).toBe('my-jwt');
    });

    it('clearToken removes the token', () => {
        setToken('my-jwt');
        clearToken();
        expect(getToken()).toBeNull();
    });
});

describe('apiFetch', () => {
    it('sends JSON GET with Authorization header when token exists', async () => {
        setToken('tok123');
        mockInvoke.mockResolvedValueOnce(jsonResponse({ data: 42 }));

        const result = await apiFetch('/api/test');
        expect(result).toEqual({ data: 42 });

        const { request } = (mockInvoke.mock.calls[0][1] as any);
        expect(request.headers['Authorization']).toBe('Bearer tok123');
        expect(request.headers['Content-Type']).toBe('application/json');
        expect(request.method).toBe('GET');
    });

    it('omits Authorization when no token is set', async () => {
        mockInvoke.mockResolvedValueOnce(jsonResponse({}));
        await apiFetch('/api/open');

        const { request } = (mockInvoke.mock.calls[0][1] as any);
        expect(request.headers['Authorization']).toBeUndefined();
    });

    it('throws on non-ok response', async () => {
        mockInvoke.mockResolvedValueOnce(jsonResponse({ error: 'Nope' }, 403));
        await expect(apiFetch('/api/fail')).rejects.toThrow('Nope');
    });
});

describe('apiFetchProto', () => {
    it('sets Accept header to application/x-protobuf', async () => {
        mockInvoke.mockResolvedValueOnce({ status: 200, body: [0, 0, 0, 0] });

        const result = await apiFetchProto('/api/proto');
        expect(result).toBeInstanceOf(Uint8Array);

        const { request } = (mockInvoke.mock.calls[0][1] as any);
        expect(request.headers['Accept']).toBe('application/x-protobuf');
    });

    it('sets Content-Type for Uint8Array body', async () => {
        mockInvoke.mockResolvedValueOnce({ status: 200, body: [0, 0] });

        await apiFetchProto('/api/proto', { method: 'POST', body: new Uint8Array([1, 2]) });
        const { request } = (mockInvoke.mock.calls[0][1] as any);
        expect(request.headers['Content-Type']).toBe('application/x-protobuf');
    });
});

