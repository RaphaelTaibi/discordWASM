export type ClientSignalMessage =
    | { type: 'join'; channelId: string; userId: string; username: string }
    | { type: 'leave'; channelId: string; userId: string }
    | { type: 'offer'; sdp: RTCSessionDescriptionInit }
    | { type: 'answer'; sdp: RTCSessionDescriptionInit }
    | { type: 'ice'; candidate: RTCIceCandidateInit }
    | { type: 'media-state'; channelId: string; userId: string; isMuted: boolean; isDeafened: boolean }
    | { type: 'chat'; channelId: string; from: string; username: string; message: string; timestamp: number };
