export interface VoicePeer {
    userId: string;
    username: string;
}

export type ClientSignalMessage =
    | { type: 'join'; channelId: string; userId: string; username: string }
    | { type: 'leave'; channelId: string; userId: string }
    | { type: 'offer'; channelId: string; from: string; to: string; sdp: RTCSessionDescriptionInit }
    | { type: 'answer'; channelId: string; from: string; to: string; sdp: RTCSessionDescriptionInit }
    | { type: 'ice'; channelId: string; from: string; to: string; candidate: RTCIceCandidateInit };

export type ServerSignalMessage =
    | { type: 'joined'; channelId: string; peers: VoicePeer[] }
    | { type: 'peer-joined'; channelId: string; peer: VoicePeer }
    | { type: 'peer-left'; channelId: string; userId: string }
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

export interface VoiceState {
    channelId: string | null;
    participants: VoicePeer[];
    isConnected: boolean;
    isMuted: boolean;
    error: string | null;
    joinChannel: (channelId: string, username: string) => Promise<void>;
    leaveChannel: () => void;
    toggleMute: () => void;
    remoteStreams: Map<string, MediaStream>;
    remoteVideoStreams: Map<string, MediaStream>;
    addScreenTrack: (stream: MediaStream) => void;
    removeScreenTrack: () => void;
}

