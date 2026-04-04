import VoiceState from './voiceState.model';
import ChatMessage from './chatMessage.model';

export default interface ExtendedVoiceState extends VoiceState {
    networkQuality: 0 | 1 | 2 | 3;
    ping: number;
    chatMessages: ChatMessage[];
    sendChatMessage: (message: string) => void;
    setUserInfo: (username: string, userId: string) => void;
    channelStartedAt?: number;
    smartGateEnabled: boolean;
    setSmartGateEnabled: (enabled: boolean) => void;
}
