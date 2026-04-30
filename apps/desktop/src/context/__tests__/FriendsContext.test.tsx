import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

/* ── Mock dependencies ── */
vi.mock('../../api/friends.api', () => ({
    listFriends: vi.fn(async () => [
        { id: 'u1', username: 'alice', displayName: 'Alice', avatar: null, publicKey: 'pk1' },
    ]),
    listPending: vi.fn(async () => []),
    sendFriendRequest: vi.fn(async () => ({ id: 'fr1', status: 'pending' })),
    acceptRequest: vi.fn(async () => ({ status: 'ok' })),
    rejectRequest: vi.fn(async () => ({ status: 'ok' })),
    removeFriend: vi.fn(async () => ({ removed: true })),
    removeFriendByUser: vi.fn(async () => ({ removed: true })),
}));

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ token: 'jwt-test' }),
}));

vi.mock('../../context/ToastContext', () => ({
    useToast: () => ({ addToast: vi.fn() }),
}));

import { FriendsProvider, useFriends } from '../../context/FriendsContext';
import * as friendsApi from '../../api/friends.api';

function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(FriendsProvider, null, children);
}

beforeEach(() => vi.clearAllMocks());

describe('FriendsContext', () => {
    it('useFriends throws outside provider', () => {
        expect(() => renderHook(() => useFriends())).toThrow();
    });

    it('fetches friends on mount when authenticated', async () => {
        const { result } = renderHook(() => useFriends(), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.friends).toHaveLength(1);
        expect(result.current.friends[0].username).toBe('alice');
    });

    it('sendRequest calls API and refreshes', async () => {
        const { result } = renderHook(() => useFriends(), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => { await result.current.sendRequest('u42'); });
        expect(friendsApi.sendFriendRequest).toHaveBeenCalledWith('u42');
        // No more polling/auto-refresh on actions — recipients are notified
        // through the WS bus, the sender just fires-and-forgets.
        expect(friendsApi.listFriends).toHaveBeenCalledTimes(1);
    });

    it('acceptRequest calls API and refreshes', async () => {
        const { result } = renderHook(() => useFriends(), { wrapper });
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => { await result.current.acceptRequest('req1'); });
        expect(friendsApi.acceptRequest).toHaveBeenCalledWith('req1');
    });
});

