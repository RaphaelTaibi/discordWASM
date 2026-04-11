import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

/* ── WASM mock — replaces src/pkg/core_wasm for all test suites ── */
vi.mock('../pkg/core_wasm', async () => import('../__mocks__/pkg/core_wasm'));

/* ── Stub browser APIs missing in jsdom ── */

// localStorage is already available in jsdom, but reset between tests
beforeEach(() => {
    localStorage.clear();
});

// Minimal AudioContext stub
if (typeof globalThis.AudioContext === 'undefined') {
    globalThis.AudioContext = vi.fn().mockImplementation(() => ({
        createGain: vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() })),
        createMediaStreamSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
        close: vi.fn(),
        state: 'running',
    })) as any;
}

// Minimal MediaStream stub
if (typeof globalThis.MediaStream === 'undefined') {
    globalThis.MediaStream = vi.fn().mockImplementation(() => ({
        getAudioTracks: vi.fn(() => []),
        getVideoTracks: vi.fn(() => []),
        getTracks: vi.fn(() => []),
        addTrack: vi.fn(),
        removeTrack: vi.fn(),
    })) as any;
}

// Minimal RTCPeerConnection stub
if (typeof globalThis.RTCPeerConnection === 'undefined') {
    globalThis.RTCPeerConnection = vi.fn().mockImplementation(() => ({
        createOffer: vi.fn(),
        createAnswer: vi.fn(),
        setLocalDescription: vi.fn(),
        setRemoteDescription: vi.fn(),
        addTrack: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    })) as any;
}

/* ── Mock import.meta.env ── */
if (!import.meta.env.VITE_SIGNALING_URL) {
    (import.meta.env as any).VITE_SIGNALING_URL = 'ws://localhost:8080/ws';
}
if (!import.meta.env.VITE_API_URL) {
    (import.meta.env as any).VITE_API_URL = 'http://localhost:8080';
}

