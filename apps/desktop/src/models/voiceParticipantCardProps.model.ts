export default interface VoiceParticipantCardProps {
    username: string;
    userId: string;
    isMuted?: boolean;
    isDeafened?: boolean;
    isSpeaking?: boolean;
    avatarUrl?: string | null;
}

