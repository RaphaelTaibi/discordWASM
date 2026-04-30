import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFriendsRealtime } from '../useFriendsRealtime';
import { emitSignalingEvent } from '../../lib/signalingBus';
import { UserSummary } from '../../models/auth/serverAuth.model';
import { PendingRequest } from '../../models/social/friend.model';

const _alice: UserSummary = {
    id: 'u-alice', username: 'alice', displayName: 'Alice', avatar: null, publicKey: 'pk-alice',
};

const _pendingFromBob: PendingRequest = {
    id: 'req-1',
    from: { id: 'u-bob', username: 'bob', displayName: 'Bob', avatar: null, publicKey: 'pk-bob' },
    createdAtMs: 1,
};

describe('useFriendsRealtime', () => {
    it('appends incoming requests to pending and notifies', () => {
        let _pending: PendingRequest[] = [];
        let _friends: UserSummary[] = [];
        const _setPending = vi.fn((u) => { _pending = typeof u === 'function' ? u(_pending) : u; });
        const _setFriends = vi.fn((u) => { _friends = typeof u === 'function' ? u(_friends) : u; });
        const _onNotify = vi.fn();

        renderHook(() =>
            useFriendsRealtime({ setPending: _setPending, setFriends: _setFriends, onNotify: _onNotify }),
        );

        act(() => {
            emitSignalingEvent('friend-request-received', {
                type: 'friend-request-received',
                request: _pendingFromBob,
            });
        });

        expect(_pending).toHaveLength(1);
        expect(_pending[0].id).toBe('req-1');
        expect(_onNotify).toHaveBeenCalledWith(expect.stringContaining('Bob'), 'info');
    });

    it('adds accepted friends and removes from pending on accept event', () => {
        let _pending: PendingRequest[] = [_pendingFromBob];
        let _friends: UserSummary[] = [];
        const _setPending = vi.fn((u) => { _pending = typeof u === 'function' ? u(_pending) : u; });
        const _setFriends = vi.fn((u) => { _friends = typeof u === 'function' ? u(_friends) : u; });

        renderHook(() => useFriendsRealtime({ setPending: _setPending, setFriends: _setFriends }));

        act(() => {
            emitSignalingEvent('friend-request-accepted', {
                type: 'friend-request-accepted',
                requestId: 'req-1',
                friend: _alice,
            });
        });

        expect(_friends).toEqual([_alice]);
    });

    it('drops requests on decline / cancel and friends on remove', () => {
        let _pending: PendingRequest[] = [_pendingFromBob];
        let _friends: UserSummary[] = [_alice];
        const _setPending = vi.fn((u) => { _pending = typeof u === 'function' ? u(_pending) : u; });
        const _setFriends = vi.fn((u) => { _friends = typeof u === 'function' ? u(_friends) : u; });

        renderHook(() => useFriendsRealtime({ setPending: _setPending, setFriends: _setFriends }));

        act(() => {
            emitSignalingEvent('friend-request-declined', {
                type: 'friend-request-declined', requestId: 'req-1', byUserId: 'u-bob',
            });
        });
        expect(_pending).toEqual([]);

        act(() => {
            emitSignalingEvent('friend-removed', {
                type: 'friend-removed', friendshipId: 'f-1', byUserId: 'u-alice',
            });
        });
        expect(_friends).toEqual([]);
    });
});

