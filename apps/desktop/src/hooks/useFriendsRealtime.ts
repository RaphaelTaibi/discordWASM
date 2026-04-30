import { Dispatch, SetStateAction, useEffect } from 'react';
import { UserSummary } from '../models/auth/serverAuth.model';
import { PendingRequest } from '../models/social/friend.model';
import { subscribeSignalingEvent } from '../lib/signalingBus';

export interface UseFriendsRealtimeProps {
    /** Set the list of incoming pending requests. */
    setPending: Dispatch<SetStateAction<PendingRequest[]>>;
    /** Set the list of accepted friends. */
    setFriends: Dispatch<SetStateAction<UserSummary[]>>;
    /** Optional notifier for UX surface (toasts). */
    onNotify?: (message: string, kind: 'info' | 'success') => void;
}

/**
 * Subscribes to signaling-bus friend events and applies them to local state.
 * Keeps state-mutation logic out of the context per AGENTS.md conventions.
 */
export function useFriendsRealtime({
    setPending,
    setFriends,
    onNotify,
}: UseFriendsRealtimeProps): void {
    useEffect(() => {
        const _unsubReceived = subscribeSignalingEvent('friend-request-received', (e) => {
            setPending((prev) =>
                prev.some((p) => p.id === e.request.id) ? prev : [...prev, e.request],
            );
            const _name = e.request.from?.displayName ?? e.request.from?.username ?? 'Quelqu’un';
            onNotify?.(`${_name} t’a envoyé une demande d’ami`, 'info');
        });

        const _unsubAccepted = subscribeSignalingEvent('friend-request-accepted', (e) => {
            setFriends((prev) =>
                prev.some((f) => f.id === e.friend.id) ? prev : [...prev, e.friend],
            );
            const _name = e.friend.displayName || e.friend.username;
            onNotify?.(`${_name} a accepté ta demande d’ami`, 'success');
        });

        const _unsubDeclined = subscribeSignalingEvent('friend-request-declined', (e) => {
            setPending((prev) => prev.filter((p) => p.id !== e.requestId));
        });

        const _unsubCancelled = subscribeSignalingEvent('friend-request-cancelled', (e) => {
            setPending((prev) => prev.filter((p) => p.id !== e.requestId));
        });

        const _unsubRemoved = subscribeSignalingEvent('friend-removed', (e) => {
            setFriends((prev) => prev.filter((f) => f.id !== e.byUserId));
        });

        return () => {
            _unsubReceived();
            _unsubAccepted();
            _unsubDeclined();
            _unsubCancelled();
            _unsubRemoved();
        };
    }, [setPending, setFriends, onNotify]);
}

