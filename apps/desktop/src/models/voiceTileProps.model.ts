export default interface VoiceTileProps {
    userId: string;
    username: string;
    isSpeaking: boolean;
    isMuted: boolean;
    isDeafened: boolean;
    videoStream: MediaStream | null;
    screenStream: MediaStream | null;
    avatarUrl: string | null;
    isLocal: boolean;
    isSpotlighted: boolean;
    isWatchingSpotlight: boolean;
    onClick?: () => void;
}

