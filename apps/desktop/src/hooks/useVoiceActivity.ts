import { useEffect, useRef, useState } from 'react';

const VAD_THRESHOLD = 30;
const POLL_INTERVAL_MS = 100;

export const useVoiceActivity = (
    remoteStreams: Map<string, MediaStream>,
    localUserId?: string,
    localStream?: MediaStream | null,
    isLocalMuted?: boolean,
): Map<string, boolean> => {
    const [speakingMap, setSpeakingMap] = useState<Map<string, boolean>>(new Map());
    
    const sharedAudioCtxRef = useRef<AudioContext | null>(null);
    const analyzersRef = useRef<Map<string, { analyser: AnalyserNode, source: MediaStreamAudioSourceNode }>>(new Map());
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        try {
            if (!sharedAudioCtxRef.current || sharedAudioCtxRef.current.state === 'closed') {
                const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
                if (AudioContextClass) {
                    sharedAudioCtxRef.current = new AudioContextClass();
                }
            }
        } catch (e) {
            console.error("Failed to create AudioContext for VAD", e);
            return;
        }
        
        const ctx = sharedAudioCtxRef.current;
        if (!ctx) return;

        const currentAnalyzers = analyzersRef.current;
        const allStreams = new Map(remoteStreams);
        if (localUserId && localStream && !isLocalMuted) {
            allStreams.set(localUserId, localStream);
        }

        // Nettoyage
        for (const [id, entry] of currentAnalyzers.entries()) {
            if (!allStreams.has(id)) {
                try {
                    entry.source.disconnect();
                    entry.analyser.disconnect();
                } catch (e) {}
                currentAnalyzers.delete(id);
            }
        }

        // Création
        for (const [id, stream] of allStreams.entries()) {
            if (!currentAnalyzers.has(id) && stream.active && stream.getAudioTracks().length > 0) {
                try {
                    if (ctx.state === 'suspended') {
                        void ctx.resume().catch(() => {});
                    }
                    
                    const analyser = ctx.createAnalyser();
                    analyser.fftSize = 256;
                    analyser.smoothingTimeConstant = 0.4;
                    const source = ctx.createMediaStreamSource(stream);
                    source.connect(analyser);
                    currentAnalyzers.set(id, { analyser, source });
                } catch (e) {
                    console.warn("[useVoiceActivity] Analyser error for", id, e);
                }
            }
        }

        if (intervalRef.current) clearInterval(intervalRef.current);

        if (currentAnalyzers.size > 0) {
            const dataArray = new Uint8Array(128);
            intervalRef.current = setInterval(() => {
                setSpeakingMap(prev => {
                    const next = new Map<string, boolean>();
                    let hasChanged = false;

                    for (const [id, entry] of currentAnalyzers.entries()) {
                        let isSpeaking = false;
                        if (!(isLocalMuted && id === localUserId)) {
                            try {
                                entry.analyser.getByteFrequencyData(dataArray);
                                let sum = 0;
                                for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                                isSpeaking = (sum / dataArray.length) > VAD_THRESHOLD;
                            } catch (e) {}
                        }
                        next.set(id, isSpeaking);
                        if (next.get(id) !== prev.get(id)) hasChanged = true;
                    }

                    if (next.size !== prev.size) hasChanged = true;
                    return hasChanged ? next : prev;
                });
            }, POLL_INTERVAL_MS);
        } else {
            setSpeakingMap(new Map());
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [remoteStreams, localUserId, localStream, isLocalMuted]);

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            for (const entry of analyzersRef.current.values()) {
                try {
                    entry.source.disconnect();
                    entry.analyser.disconnect();
                } catch (e) {}
            }
            analyzersRef.current.clear();
            if (sharedAudioCtxRef.current && sharedAudioCtxRef.current.state !== 'closed') {
                void sharedAudioCtxRef.current.close().catch(() => {});
            }
        };
    }, []);

    return speakingMap;
};
