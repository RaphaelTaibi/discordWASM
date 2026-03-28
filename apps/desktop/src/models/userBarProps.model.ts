export default interface UserBarProps {
    username: string;
    isConnected: boolean;
    isMuted: boolean;
    onToggleMute: () => void;
    isDeafened: boolean;
    onToggleDeafen: () => void;
    channelId: string | null;
    isSpeaking?: boolean;
}

