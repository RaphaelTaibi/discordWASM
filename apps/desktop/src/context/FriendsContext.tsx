import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { UserSummary } from '../models/auth/serverAuth.model';
import { PendingRequest } from '../models/social/friend.model';
import FriendsContextValue from '../models/social/friendsContextValue.model';
import {
    listFriends,
    listPending,
    sendFriendRequest,
    acceptRequest as apiAccept,
    rejectRequest as apiReject,
    removeFriend as apiRemove,
    removeFriendByUser as apiRemoveByUser,
} from '../api/friends.api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { useFriendsRealtime } from '../hooks/useFriendsRealtime';


const FriendsContext = createContext<FriendsContextValue | undefined>(undefined);

/**
 * Provider managing the friends list and pending requests.
 *
 * Initial sync: REST fetch on mount/login.
 * Live updates: WebSocket-pushed events routed via the signaling bus
 * (see {@link useFriendsRealtime}). No polling — the previous 10 s interval
 * has been removed in favor of server-pushed notifications.
 */
export const FriendsProvider = ({ children }: { children: ReactNode }) => {
    const { token } = useAuth();
    const { addToast } = useToast();
    const [friends, setFriends] = useState<UserSummary[]>([]);
    const [pending, setPending] = useState<PendingRequest[]>([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const [_friends, _pending] = await Promise.all([listFriends(), listPending()]);
            setFriends(_friends);
            setPending(_pending);
        } catch (e) {
            console.error('Failed to fetch friends', e);
        } finally {
            setLoading(false);
        }
    }, [token]);

    // Initial sync on mount / token change — source of truth for offline catch-up.
    useEffect(() => { refresh(); }, [refresh]);

    // Live updates from the signaling WS via the bus.
    useFriendsRealtime({
        setPending,
        setFriends,
        onNotify: (message, kind) => addToast(message, kind === 'success' ? 'success' : 'info'),
    });

    const sendRequest = useCallback(async (toUserId: string) => {
        await sendFriendRequest(toUserId);
        // Recipient is notified via WS; the sender has no local pending entry to add.
    }, []);

    const acceptRequest = useCallback(async (requestId: string) => {
        await apiAccept(requestId);
        // Optimistic local update: remove from pending and add to friends list.
        const _accepted = pending.find((p) => p.id === requestId);
        setPending((prev) => prev.filter((p) => p.id !== requestId));
        if (_accepted?.from) {
            setFriends((prev) =>
                prev.some((f) => f.id === _accepted.from.id) ? prev : [...prev, _accepted.from],
            );
        }
    }, [pending]);

    const rejectRequest = useCallback(async (requestId: string) => {
        await apiReject(requestId);
        setPending((prev) => prev.filter((p) => p.id !== requestId));
    }, []);

    const removeFriend = useCallback(async (friendshipId: string) => {
        await apiRemove(friendshipId);
        // Friendship id is not directly mapped to a user id locally — rely on
        // the next refresh / WS echo to converge. Trigger a refresh just in case.
        await refresh();
    }, [refresh]);

    const removeFriendByUser = useCallback(async (userId: string) => {
        await apiRemoveByUser(userId);
        setFriends((prev) => prev.filter((f) => f.id !== userId));
        setPending((prev) => prev.filter((p) => p.from?.id !== userId));
    }, []);

    return (
        <FriendsContext.Provider value={{
            friends, pending, loading, refresh,
            sendRequest, acceptRequest, rejectRequest, removeFriend, removeFriendByUser,
        }}>
            {children}
        </FriendsContext.Provider>
    );
};

/**
 * @throws {Error} If called outside of a FriendsProvider.
 * @returns {FriendsContextValue} Friends state and actions.
 */
export const useFriends = (): FriendsContextValue => {
    const ctx = useContext(FriendsContext);
    if (!ctx) throw new Error('useFriends must be used within a FriendsProvider');
    return ctx;
};

