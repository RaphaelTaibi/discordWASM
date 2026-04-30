import { UserSummary } from '../auth/serverAuth.model';
import { PendingRequest } from './friend.model';

/** Pushed to the recipient when an incoming friend request lands. */
export interface FriendRequestReceivedPayload {
    type: 'friend-request-received';
    request: PendingRequest;
}

/** Pushed to the sender when the recipient accepts the request. */
export interface FriendRequestAcceptedPayload {
    type: 'friend-request-accepted';
    requestId: string;
    friend: UserSummary;
}

/** Pushed to the sender when the recipient declines. */
export interface FriendRequestDeclinedPayload {
    type: 'friend-request-declined';
    requestId: string;
    byUserId: string;
}

/** Pushed to the recipient when the original sender cancels a pending request. */
export interface FriendRequestCancelledPayload {
    type: 'friend-request-cancelled';
    requestId: string;
    byUserId: string;
}

/** Pushed to the other party when an accepted friendship is removed. */
export interface FriendRemovedPayload {
    type: 'friend-removed';
    friendshipId: string;
    byUserId: string;
}

export type FriendEventPayload =
    | FriendRequestReceivedPayload
    | FriendRequestAcceptedPayload
    | FriendRequestDeclinedPayload
    | FriendRequestCancelledPayload
    | FriendRemovedPayload;

