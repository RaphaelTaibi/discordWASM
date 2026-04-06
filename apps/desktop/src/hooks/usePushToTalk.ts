import { useCallback, useEffect, useRef, useState } from 'react';
import UsePushToTalkProps from '../models/usePushToTalkProps.model';

export const usePushToTalk = ({ vadMode, pttKey, isMuted, localStreamRef }: UsePushToTalkProps) => {
    const [isPttActive, setIsPttActive] = useState(false);

    const isPttActiveRef = useRef(false);
    const isMutedRef = useRef(false);
    const pttKeyRef = useRef(pttKey);
    const vadModeRef = useRef(vadMode);

    useEffect(() => { pttKeyRef.current = pttKey; }, [pttKey]);
    useEffect(() => { vadModeRef.current = vadMode; enforceTrackEnabled(); }, [vadMode]);
    useEffect(() => { isMutedRef.current = isMuted; enforceTrackEnabled(); }, [isMuted]);

    const enforceTrackEnabled = useCallback(() => {
        if (!localStreamRef.current) return;
        const shouldBeEnabled = !isMutedRef.current && (vadModeRef.current === 'VAD' || isPttActiveRef.current);
        localStreamRef.current.getAudioTracks().forEach(t => t.enabled = shouldBeEnabled);
    }, [localStreamRef]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === pttKeyRef.current && vadModeRef.current === 'PTT' && !isPttActiveRef.current) {
                isPttActiveRef.current = true;
                setIsPttActive(true);
                enforceTrackEnabled();
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === pttKeyRef.current && vadModeRef.current === 'PTT' && isPttActiveRef.current) {
                isPttActiveRef.current = false;
                setIsPttActive(false);
                enforceTrackEnabled();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [enforceTrackEnabled]);

    return { isPttActive, enforceTrackEnabled };
};

