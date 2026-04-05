import { useEffect, useRef } from 'react';
import VoiceAudioRendererProps from '../../models/voiceAudioRendererProps.model';
import { useVoiceStore } from '../../context/VoiceContext';

export const VoiceAudioRenderer = ({ stream, muted, peerId }: VoiceAudioRendererProps & { peerId: string }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const { userVolumes } = useVoiceStore();
    const volume = userVolumes.get(peerId) ?? 1;

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !stream) return;

        if (audio.srcObject !== stream) {
            audio.srcObject = stream;
        }
        
        const safeVolume = Math.max(0, Math.min(1, volume));

        audio.muted = muted || safeVolume === 0;
        audio.volume = safeVolume;

        const playAudio = async () => {
            try {
                if (audio.paused) {
                    await audio.play();
                }
            } catch (err) {
                console.warn("Échec de la lecture audio automatique:", err);
            }
        };

        playAudio();

        const selectedSpeaker = localStorage.getItem('selectedSpeaker');
        if (selectedSpeaker && 'setSinkId' in audio) {
            (audio as any).setSinkId(selectedSpeaker).catch((err: any) => {
                console.warn("Impossible de changer le périphérique de sortie audio:", err);
            });
        }
    }, [stream, muted, volume]);

    return (
        <audio 
            ref={audioRef} 
            autoPlay 
            playsInline 
            style={{ display: 'none' }} 
        />
    );
};
