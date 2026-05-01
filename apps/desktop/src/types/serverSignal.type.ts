import VoicePeer from '../models/voice/voicePeer.model';
import { UserSummary } from '../models/auth/serverAuth.model';
import { FriendEventPayload } from '../models/social/friendEventPayload.model';

export type ServerSignal =
    | { type: 'joined'; channelId: string; peers: VoicePeer[]; startedAt: number }
    | { type: 'peer-joined'; channelId: string; peer: VoicePeer }
    | { type: 'peer-left'; channelId: string; userId: string }
    | { type: 'answer'; sdp: RTCSessionDescriptionInit }
    | { type: 'offer'; sdp: RTCSessionDescriptionInit }
    | { type: 'ice'; candidate: RTCIceCandidateInit }
    | { type: 'peer-state'; channelId: string; userId: string; isMuted: boolean; isDeafened: boolean }
    | { type: 'track-map'; userId: string; trackId: string; streamId: string; kind: string }
    | { type: 'chat'; channelId: string; from: string; username: string; message: string; timestamp: number }
    | { type: 'stats'; userId: string; bandwidthBps: number }
    | { type: 'error'; message: string }
    // ---- Phase 3 push events ----
    | { type: 'authenticated'; userId: string; ok: boolean }
    | { type: 'server-member-presence'; serverId: string; userId: string; online: boolean }
    | { type: 'server-member-added'; serverId: string; member: UserSummary }
    | { type: 'server-member-removed'; serverId: string; userId: string }
    | { type: 'rpc-result'; requestId: string; result?: unknown; error?: { code: string; message: string } }
    | FriendEventPayload;
