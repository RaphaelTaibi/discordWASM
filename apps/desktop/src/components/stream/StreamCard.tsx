// src/components/stream/StreamCard.tsx
import { useEffect, useRef, useState } from 'react';
import  StreamCardProps  from '../../models/streamProps.model.ts';

export const StreamCard = ({ stream, username, isBright, isSpeaking }: StreamCardProps) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [fps, setFps] = useState(0);

    // Correction : définition de borderClass
    const borderClass = isBright
        ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
        : 'border-transparent shadow-none';

    useEffect(() => {
        const video = videoRef.current;
        if (!video) {
            return;
        }

        video.srcObject = stream;

        if (stream) {
            void video.play().catch(() => {
                // Autoplay can fail transiently if browser policies change.
            });
        }
    }, [stream]);

    // FPS counter
    useEffect(() => {
        let frameCount = 0;
        let lastTime = performance.now();
        let rafId: number;
        let stop = false;

        const updateFps = () => {
            frameCount++;
            const now = performance.now();
            if (now - lastTime >= 1000) {
                setFps(frameCount);
                frameCount = 0;
                lastTime = now;
            }
            if (!stop) {
                if (videoRef.current && 'requestVideoFrameCallback' in videoRef.current) {
                    (videoRef.current as any).requestVideoFrameCallback(updateFps);
                } else {
                    rafId = requestAnimationFrame(updateFps);
                }
            }
        };

        if (videoRef.current) {
            if ('requestVideoFrameCallback' in videoRef.current) {
                (videoRef.current as any).requestVideoFrameCallback(updateFps);
            } else {
                rafId = requestAnimationFrame(updateFps);
            }
        }
        return () => {
            stop = true;
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [stream]);

    return (
        <div className={`relative aspect-video rounded-lg overflow-hidden bg-black border-2 transition-all duration-300 hover:scale-[1.01] ${borderClass}`}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
            />

            {/* Badge Pseudo style Discord */}
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                    isBright ? 'bg-red-500 animate-pulse' : isSpeaking ? 'bg-green-500 animate-pulse' : 'bg-green-500'
                }`} />
                <span className="text-xs font-bold text-white">{username}</span>
            </div>

            {/* Overlay d'alerte si trop lumineux */}
            {isBright && (
                <div className="absolute inset-0 pointer-events-none border-[4px] border-red-500/30 animate-pulse" />
            )}

            {/* Overlay FPS en haut à droite */}
            <div style={{position: 'absolute', top: 8, right: 12, zIndex: 10, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 12, borderRadius: 4, padding: '2px 6px'}}>
                {fps} fps
            </div>
        </div>
    );
};