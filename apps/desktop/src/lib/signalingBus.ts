import { FriendEventPayload } from '../models/social/friendEventPayload.model';

/**
 * Lightweight typed pub/sub bridging the WS dispatcher (in `useSfuConnection`)
 * and feature contexts (e.g. `FriendsContext`) without coupling them.
 *
 * Event keys mirror the `type` discriminant of {@link FriendEventPayload}.
 */
type SignalingEventMap = {
    'friend-request-received': Extract<FriendEventPayload, { type: 'friend-request-received' }>;
    'friend-request-accepted': Extract<FriendEventPayload, { type: 'friend-request-accepted' }>;
    'friend-request-declined': Extract<FriendEventPayload, { type: 'friend-request-declined' }>;
    'friend-request-cancelled': Extract<FriendEventPayload, { type: 'friend-request-cancelled' }>;
    'friend-removed': Extract<FriendEventPayload, { type: 'friend-removed' }>;
};

type Handler<K extends keyof SignalingEventMap> = (payload: SignalingEventMap[K]) => void;

const _target = new EventTarget();

/**
 * Emits a signaling event to every subscriber of `type`.
 * @param type Event discriminant.
 * @param payload Full payload (including the `type` field, matching server WS schema).
 */
export const emitSignalingEvent = <K extends keyof SignalingEventMap>(
    type: K,
    payload: SignalingEventMap[K],
): void => {
    _target.dispatchEvent(new CustomEvent(type, { detail: payload }));
};

/**
 * Subscribes to a signaling event.
 * @returns A teardown function that removes the listener.
 */
export const subscribeSignalingEvent = <K extends keyof SignalingEventMap>(
    type: K,
    handler: Handler<K>,
): (() => void) => {
    const _listener = (e: Event) => handler((e as CustomEvent<SignalingEventMap[K]>).detail);
    _target.addEventListener(type, _listener);
    return () => _target.removeEventListener(type, _listener);
};

