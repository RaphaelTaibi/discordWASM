import { describe, it, expect, vi } from 'vitest';
import { emitSignalingEvent, subscribeSignalingEvent } from '../lib/signalingBus';

describe('signalingBus', () => {
    it('delivers payloads to subscribers and supports unsubscription', () => {
        const _spy = vi.fn();
        const _off = subscribeSignalingEvent('friend-request-declined', _spy);

        emitSignalingEvent('friend-request-declined', {
            type: 'friend-request-declined',
            requestId: 'r1',
            byUserId: 'u9',
        });

        expect(_spy).toHaveBeenCalledTimes(1);
        expect(_spy).toHaveBeenCalledWith({
            type: 'friend-request-declined',
            requestId: 'r1',
            byUserId: 'u9',
        });

        _off();
        emitSignalingEvent('friend-request-declined', {
            type: 'friend-request-declined',
            requestId: 'r2',
            byUserId: 'u9',
        });
        expect(_spy).toHaveBeenCalledTimes(1);
    });

    it('isolates subscribers by event type', () => {
        const _received = vi.fn();
        const _accepted = vi.fn();
        subscribeSignalingEvent('friend-request-cancelled', _received);
        subscribeSignalingEvent('friend-removed', _accepted);

        emitSignalingEvent('friend-request-cancelled', {
            type: 'friend-request-cancelled',
            requestId: 'r1',
            byUserId: 'u9',
        });

        expect(_received).toHaveBeenCalledTimes(1);
        expect(_accepted).not.toHaveBeenCalled();
    });
});

