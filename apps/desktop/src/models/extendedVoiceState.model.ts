import VoiceState from './voiceState.model';
import ChatMessage from './chatMessage.model';

export default interface ExtendedVoiceState extends VoiceState {
    networkQuality: 0 | 1 | 2 | 3;
    ping: number;
    chatMessages: ChatMessage[];
    bandwidthStats: Map<string, number>;
    sendChatMessage: (message: string) => void;
    setUserInfo: (username: string, userId: string) => void;
    channelStartedAt?: number;
    smartGateEnabled: boolean;
    setSmartGateEnabled: (enabled: boolean) => void;
    vadAuto: boolean;
    setVadAuto: (enabled: boolean) => void;
    vadThreshold: number;
    setVadThreshold: (threshold: number) => void;
    vadMode: 'VAD' | 'PTT';
    setVadMode: (mode: 'VAD' | 'PTT') => void;
    pttKey: string;
    setPttKey: (key: string) => void;
    isPttActive: boolean;
    setVoiceAvatar: (url: string | null) => void;
    voiceAvatar: string | null;
    rawMicVolumeRef: React.MutableRefObject<number>;
    averagePing: number;
    packetLoss: number;
    webrtcNoiseSuppressionEnabled: boolean;
    setWebrtcNoiseSuppressionEnabled: (enabled: boolean) => void;
    selectedMic: string;
    setSelectedMic: (deviceId: string) => void;
    selectedSpeaker: string;
    setSelectedSpeaker: (deviceId: string) => void;
}
