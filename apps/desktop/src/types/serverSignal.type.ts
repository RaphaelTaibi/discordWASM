import VoicePeer from '../models/voicePeer.model';

export type ServerSignalMessage =
    | { type: 'joined'; channelId: string; peers: VoicePeer[] }
    | { type: 'peer-joined'; channelId: string; peer: VoicePeer }
    | { type: 'peer-left'; channelId: string; userId: string }
    | { type: 'peer-state'; channelId: string; userId: string; isMuted: boolean; isDeafened: boolean }
    | {
        type: 'offer';
        channelId: string;
        from: string;
        fromUsername: string;
        sdp: RTCSessionDescriptionInit;
    }
    | {
        type: 'answer';
        channelId: string;
        from: string;
        fromUsername: string;
        sdp: RTCSessionDescriptionInit;
    }
    | {
        type: 'ice';
        channelId: string;
        from: string;
        fromUsername: string;
        candidate: RTCIceCandidateInit;
    }
    | { type: 'error'; message: string };

