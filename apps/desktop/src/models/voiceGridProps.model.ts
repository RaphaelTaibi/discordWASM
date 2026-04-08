import VoiceTileProps from './voiceTileProps.model';

export default interface VoiceGridProps {
    tiles: VoiceTileProps[];
    spotlightUserId: string | null;
    onSpotlight: (userId: string | null) => void;
    localUserId: string;
}

