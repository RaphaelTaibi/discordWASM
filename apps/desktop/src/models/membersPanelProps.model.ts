export default interface MembersPanelProps {
    participants: { userId: string; username: string; isMuted?: boolean; isDeafened?: boolean }[];
    isConnected: boolean;
    channelId: string | null;
    speakingUsers?: Map<string, boolean>;
}

