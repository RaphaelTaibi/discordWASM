import VoicePeer from './voicePeer.model';

export default interface VoiceState {
    channelId: string | null;
    participants: VoicePeer[];
    isConnected: boolean;
    isMuted: boolean;
    isDeafened: boolean;
    error: string | null;
    localUserId: string;
    localStream: MediaStream | null;
    /** Raw mic stream before noise-gate, used for VAD analysis. */
    rawLocalStream: MediaStream | null;
    channelStartedAt?: number;
    joinChannel: (channelId: string, username: string) => void;
    leaveChannel: () => void;
    toggleMute: () => void;
    toggleDeafen: () => void;
    remoteStreams: Map<string, MediaStream>;
    remoteVideoStreams: Map<string, MediaStream>;
    addScreenTrack: (stream: MediaStream) => void;
    removeScreenTrack: () => void;
    userVolumes: Map<string, number>;
    setUserVolume: (userId: string, volume: number) => void;
    smartGateEnabled: boolean;
    setSmartGateEnabled: (enabled: boolean) => void;
}
