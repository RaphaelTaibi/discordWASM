import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

/* ── Module mocks ── */

// Capture last sent WS frame and fake an immediate echo for `dm-send`.
const _sentFrames: unknown[] = [];

vi.mock('../../api/dm.ws', async () => {
    return {
        sendDmWs: vi.fn(async (toUserId: string, message: string, clientMsgId: string) => {
            _sentFrames.push({ toUserId, message, clientMsgId });
        }),
        fetchDmHistory: vi.fn(async () => []),
        fetchDmPartners: vi.fn(async () => []),
    };
});

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ userId: 'me', serverUserId: 'me' }),
}));

// FriendsContext is consumed by DmProvider for unknown-peer lookups.
vi.mock('../../context/FriendsContext', () => ({
    useFriends: () => ({ friends: [] }),
}));

// Replace the realtime hook by a deterministic stub that exposes its
// `setConversations` setter so the test can drive bus events manually.
let _setConvsFromHook: React.Dispatch<React.SetStateAction<Record<string, unknown>>> | null = null;
vi.mock('../../hooks/useDmRealtime', () => ({
    useDmRealtime: ({ setConversations }: { setConversations: React.Dispatch<React.SetStateAction<Record<string, unknown>>> }) => {
        _setConvsFromHook = setConversations;
    },
}));

import { DmProvider, useDm } from '../../context/DmContext';
import { ToastProvider } from '../../context/ToastContext';
import * as dmApi from '../../api/dm.ws';
import type { DmMessage } from '../../models/social/dmMessage.model';

function wrapper({ children }: { children: React.ReactNode }) {
    // DmProvider now also surfaces inbound DM toasts via `useDmNotifications`,
    // which depends on ToastProvider. Wrap accordingly so the spec mirrors
    // the real app composition.
    return React.createElement(
        ToastProvider,
        null,
        React.createElement(DmProvider, null, children),
    );
}

const _alice = {
    id: 'alice',
    username: 'alice',
    displayName: 'Alice',
    avatar: null,
    publicKey: 'pk-a',
};

beforeEach(() => {
    _sentFrames.length = 0;
    _setConvsFromHook = null;
    vi.clearAllMocks();
});

describe('DmContext', () => {
    it('throws when used outside DmProvider', () => {
        expect(() => renderHook(() => useDm())).toThrow(/DmProvider/);
    });

    it('openDm fetches history and registers the conversation', async () => {
        (dmApi.fetchDmHistory as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            { id: 'h1', fromUserId: 'alice', toUserId: 'me', message: 'old', timestamp: 10 },
        ] satisfies DmMessage[]);

        const { result } = renderHook(() => useDm(), { wrapper });
        await act(async () => { await result.current.openDm(_alice); });

        await waitFor(() => {
            expect(result.current.conversations.alice).toBeDefined();
            expect(result.current.conversations.alice.loading).toBe(false);
        });
        expect(result.current.conversations.alice.messages).toHaveLength(1);
        expect(result.current.activePeerId).toBe('alice');
        expect(dmApi.fetchDmHistory).toHaveBeenCalledWith('alice');
    });

    it('sendDm appends an optimistic placeholder and calls the WS API', async () => {
        const { result } = renderHook(() => useDm(), { wrapper });
        await act(async () => { await result.current.openDm(_alice); });
        await waitFor(() => expect(result.current.conversations.alice.loading).toBe(false));

        await act(async () => { await result.current.sendDm('alice', '  hello  '); });

        const _msgs = result.current.conversations.alice.messages;
        expect(_msgs).toHaveLength(1);
        expect(_msgs[0].message).toBe('hello');
        expect(_msgs[0].pending).toBe(true);
        expect(_msgs[0].fromUserId).toBe('me');

        // WS frame fired with the trimmed body and a stable correlation id.
        expect(_sentFrames).toHaveLength(1);
        const _frame = _sentFrames[0] as { toUserId: string; message: string; clientMsgId: string };
        expect(_frame.toUserId).toBe('alice');
        expect(_frame.message).toBe('hello');
        expect(_frame.clientMsgId).toEqual(_msgs[0].clientMsgId);
    });

    it('closeDm removes the conversation entry', async () => {
        const { result } = renderHook(() => useDm(), { wrapper });
        await act(async () => { await result.current.openDm(_alice); });
        await waitFor(() => expect(result.current.conversations.alice).toBeDefined());

        act(() => result.current.closeDm('alice'));
        expect(result.current.conversations.alice).toBeUndefined();
        expect(result.current.activePeerId).toBeNull();
    });

    it('does not send empty bodies', async () => {
        const { result } = renderHook(() => useDm(), { wrapper });
        await act(async () => { await result.current.openDm(_alice); });
        await act(async () => { await result.current.sendDm('alice', '   '); });
        expect(_sentFrames).toHaveLength(0);
    });
});

