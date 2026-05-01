import { rpc } from '../lib/signalingTransport';
import { UserSummary } from '../models/auth/serverAuth.model';
import { FriendRequestResult, PendingRequest } from '../models/social/friend.model';

/**
 * WebSocket-RPC backed friends API. Replaces the legacy REST client; the
 * transport singleton must be initialised (WS connected + authenticated)
 * before invoking these helpers — see `signalingTransport.authenticateSignaling`.
 */

export const listFriends = (): Promise<UserSummary[]> => rpc<UserSummary[]>('friends.list');

export const listPending = (): Promise<PendingRequest[]> => rpc<PendingRequest[]>('friends.pending');

export const sendFriendRequest = (toUserId: string): Promise<FriendRequestResult> =>
    rpc<FriendRequestResult>('friends.send', { toUserId });

export const acceptRequest = (requestId: string): Promise<{ status: string }> =>
    rpc<{ status: string }>('friends.accept', { id: requestId });

export const rejectRequest = (requestId: string): Promise<{ status: string }> =>
    rpc<{ status: string }>('friends.reject', { id: requestId });

export const removeFriend = (friendshipId: string): Promise<{ removed: boolean }> =>
    rpc<{ removed: boolean }>('friends.remove', { id: friendshipId });

export const removeFriendByUser = (userId: string): Promise<{ removed: boolean }> =>
    rpc<{ removed: boolean }>('friends.removeByUser', { userId });

