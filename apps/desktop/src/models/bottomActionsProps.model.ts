export default interface BottomActionsProps {
    metricsLum: number;
    metricsStatus: string;
    isStreaming: boolean;
    onToggleStream: () => void;
    isMuted: boolean;
    onToggleMute: () => void;
    isDeafened: boolean;
    onToggleDeafen: () => void;
    channelId: string | null;
}

