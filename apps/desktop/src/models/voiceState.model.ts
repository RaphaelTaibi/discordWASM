import VoicePeer from './voicePeer.model';

export default interface VoiceState {
    channelId: string | null;
    participants: VoicePeer[];
    isConnected: boolean;
    isMuted: boolean;
    isDeafened: boolean;
    error: string | null;
    joinChannel: (channelId: string, username: string) => Promise<void>;
    leaveChannel: () => void;
    toggleMute: () => void;
    toggleDeafen: () => void;
    remoteStreams: Map<string, MediaStream>;
    remoteVideoStreams: Map<string, MediaStream>;
    addScreenTrack: (stream: MediaStream) => void;
    removeScreenTrack: () => void;
}

