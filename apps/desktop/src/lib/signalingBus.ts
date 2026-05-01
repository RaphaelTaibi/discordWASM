import { UserSummary } from '../models/auth/serverAuth.model';
import ChatMessage from '../models/chat/chatMessage.model';
import { FriendEventPayload } from '../models/social/friendEventPayload.model';

/**
 * Strongly-typed map of every event the signaling-bus can carry.
 *
 * Friend events keep their original `type`-discriminated payloads; new
 * Phase-3 push events are documented inline.
 */
export type SignalingEventMap = {
    // ---- Friend social events ----
    'friend-request-received': Extract<FriendEventPayload, { type: 'friend-request-received' }>;
    'friend-request-accepted': Extract<FriendEventPayload, { type: 'friend-request-accepted' }>;
    'friend-request-declined': Extract<FriendEventPayload, { type: 'friend-request-declined' }>;
    'friend-request-cancelled': Extract<FriendEventPayload, { type: 'friend-request-cancelled' }>;
    'friend-removed': Extract<FriendEventPayload, { type: 'friend-removed' }>;

    // ---- Phase 3 push events ----
    'authenticated': { userId: string; ok: boolean };
    'chat': ChatMessage;
    'server-member-presence': { serverId: string; userId: string; online: boolean };
    'server-member-added': { serverId: string; member: UserSummary };
    'server-member-removed': { serverId: string; userId: string };
    'rpc-result': { requestId: string; result?: unknown; error?: { code: string; message: string } };
};

type Handler<K extends keyof SignalingEventMap> = (payload: SignalingEventMap[K]) => void;

const _target = new EventTarget();

export const emitSignalingEvent = <K extends keyof SignalingEventMap>(
    type: K,
    payload: SignalingEventMap[K],
): void => {
    _target.dispatchEvent(new CustomEvent(type, { detail: payload }));
};

export const subscribeSignalingEvent = <K extends keyof SignalingEventMap>(
    type: K,
    handler: Handler<K>,
): (() => void) => {
    const _listener = (e: Event) => handler((e as CustomEvent<SignalingEventMap[K]>).detail);
    _target.addEventListener(type, _listener);
    return () => _target.removeEventListener(type, _listener);
};
