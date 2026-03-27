export type ClientSignalMessage =
    | { type: 'join'; channelId: string; userId: string; username: string }
    | { type: 'leave'; channelId: string; userId: string }
    | { type: 'offer'; channelId: string; from: string; to: string; sdp: RTCSessionDescriptionInit }
    | { type: 'answer'; channelId: string; from: string; to: string; sdp: RTCSessionDescriptionInit }
    | { type: 'ice'; channelId: string; from: string; to: string; candidate: RTCIceCandidateInit }
    | { type: 'media-state'; channelId: string; userId: string; isMuted: boolean; isDeafened: boolean };

