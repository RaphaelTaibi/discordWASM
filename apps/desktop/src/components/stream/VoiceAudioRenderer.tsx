import { useEffect, useRef } from 'react';
import VoiceAudioRendererProps from '../../models/voiceAudioRendererProps.model';

export const VoiceAudioRenderer = ({ stream, muted }: VoiceAudioRendererProps) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!audioRef.current) {
            return;
        }
        audioRef.current.srcObject = stream;
        audioRef.current.muted = muted;
    }, [stream, muted]);

    return <audio ref={audioRef} autoPlay playsInline muted={muted} />;
};

