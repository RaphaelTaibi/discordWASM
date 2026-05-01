import { useEffect, useRef, useState } from 'react';
import { listServerMembers } from '../api/server.ws';
import { subscribeServer, unsubscribeServer } from '../lib/signalingTransport';
import { subscribeSignalingEvent } from '../lib/signalingBus';
import { ServerMember } from '../models/server/serverMember.model';
import { UserSummary } from '../models/auth/serverAuth.model';

const _toMember = (s: UserSummary, ownerPublicKey: string, online: boolean = false): ServerMember => ({
    publicKey: s.publicKey ?? '',
    displayName: s.displayName,
    username: s.username,
    avatar: s.avatar ?? null,
    isOwner: (s.publicKey ?? '') === ownerPublicKey,
    online,
});

/**
 * Resolves member profiles for a server via WS RPC, subscribes to live
 * presence/membership push events, and exposes the merged view.
 *
 * @param serverId - The active server UUID.
 * @param ownerPublicKey - Owner's public key (used for the `isOwner` flag).
 */
export function useServerMembers(serverId: string | undefined, ownerPublicKey: string) {
    const [members, setMembers] = useState<ServerMember[]>([]);
    const [loading, setLoading] = useState(false);
    const seqRef = useRef(0);

    useEffect(() => {
        if (!serverId) {
            setMembers([]);
            return;
        }

        const _seq = ++seqRef.current;
        setLoading(true);
        subscribeServer(serverId).catch(() => {});

        listServerMembers(serverId)
            .then((summaries) => {
                if (_seq !== seqRef.current) return;
                setMembers(summaries.map((s) => _toMember(s, ownerPublicKey)));
            })
            .catch(() => {
                if (_seq !== seqRef.current) return;
                setMembers([]);
            })
            .finally(() => {
                if (_seq === seqRef.current) setLoading(false);
            });

        return () => {
            unsubscribeServer(serverId).catch(() => {});
        };
    }, [serverId, ownerPublicKey]);

    // Live presence updates
    useEffect(() => {
        if (!serverId) return;
        const _offPresence = subscribeSignalingEvent('server-member-presence', (e) => {
            if (e.serverId !== serverId) return;
            setMembers((prev) =>
                prev.map((m) =>
                    // Match by publicKey OR username — server emits user_id but
                    // the client still keys by publicKey for owner detection.
                    m.publicKey === e.userId || m.username === e.userId
                        ? { ...m, online: e.online }
                        : m,
                ),
            );
        });
        const _offAdded = subscribeSignalingEvent('server-member-added', (e) => {
            if (e.serverId !== serverId) return;
            setMembers((prev) => {
                if (prev.some((m) => m.publicKey === (e.member.publicKey ?? ''))) return prev;
                return [...prev, _toMember(e.member, ownerPublicKey, true)];
            });
        });
        const _offRemoved = subscribeSignalingEvent('server-member-removed', (e) => {
            if (e.serverId !== serverId) return;
            setMembers((prev) => prev.filter((m) => m.publicKey !== e.userId && m.username !== e.userId));
        });
        return () => { _offPresence(); _offAdded(); _offRemoved(); };
    }, [serverId, ownerPublicKey]);

    return { members, loading };
}
