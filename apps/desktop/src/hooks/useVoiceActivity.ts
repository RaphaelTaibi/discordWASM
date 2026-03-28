import { useEffect, useRef, useState } from 'react';
import AnalyzerEntry from '../models/analyzerEntry.model';

const VAD_THRESHOLD = 18;
const POLL_INTERVAL_MS = 50; // ~20fps

/**
 * Hook that monitors audio streams and returns a map of which users are currently speaking.
 * Works for both remote streams (from WebRTC) and the local microphone stream.
 */
export const useVoiceActivity = (
    remoteStreams: Map<string, MediaStream>,
    localUserId?: string,
    localStream?: MediaStream | null,
    isLocalMuted?: boolean,
): Map<string, boolean> => {
    const [speakingMap, setSpeakingMap] = useState<Map<string, boolean>>(new Map());
    const analyzersRef = useRef<Map<string, AnalyzerEntry>>(new Map());
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const allStreams = new Map(remoteStreams);
        // Si mute, ne pas ajouter le localStream
        if (localUserId && localStream && !isLocalMuted) {
            allStreams.set(localUserId, localStream);
        }

        const currentAnalyzers = analyzersRef.current;

        // Remove analyzers for streams that no longer exist
        for (const [peerId, entry] of currentAnalyzers) {
            if (!allStreams.has(peerId)) {
                entry.source.disconnect();
                entry.analyser.disconnect();
                void entry.ctx.close();
                currentAnalyzers.delete(peerId);
            }
        }

        // Add analyzers for new streams
        for (const [peerId, stream] of allStreams) {
            if (!currentAnalyzers.has(peerId) && stream.getAudioTracks().length > 0) {
                try {
                    const ctx = new AudioContext();
                    const analyser = ctx.createAnalyser();
                    analyser.fftSize = 256;
                    analyser.smoothingTimeConstant = 0.5;
                    const source = ctx.createMediaStreamSource(stream);
                    source.connect(analyser);
                    currentAnalyzers.set(peerId, { ctx, analyser, source });
                } catch {
                    // AudioContext creation can fail in edge cases
                }
            }
        }

        // Clear previous polling
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
        }

        if (currentAnalyzers.size === 0) {
            setSpeakingMap(new Map());
            return;
        }

        const dataArray = new Uint8Array(128);

        intervalRef.current = setInterval(() => {
            const next = new Map<string, boolean>();
            for (const [peerId, entry] of currentAnalyzers) {
                if (isLocalMuted && peerId === localUserId) {
                    next.set(peerId, false);
                    continue;
                }
                entry.analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const avg = sum / dataArray.length;
                next.set(peerId, avg > VAD_THRESHOLD);
            }

            setSpeakingMap((prev) => {
                // Only update if something changed to avoid re-renders
                let changed = false;
                if (prev.size !== next.size) {
                    changed = true;
                } else {
                    for (const [key, val] of next) {
                        if (prev.get(key) !== val) {
                            changed = true;
                            break;
                        }
                    }
                }
                return changed ? next : prev;
            });
        }, POLL_INTERVAL_MS);

        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [remoteStreams, localUserId, localStream, isLocalMuted]);

    // Cleanup all on unmount
    useEffect(() => {
        return () => {
            for (const entry of analyzersRef.current.values()) {
                entry.source.disconnect();
                entry.analyser.disconnect();
                void entry.ctx.close();
            }
            analyzersRef.current.clear();
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    return speakingMap;
};

