// src/components/stream/StreamCard.tsx
import { useEffect, useRef, useState } from 'react';
import  StreamCardProps  from '../../models/streamProps.model.ts';

export const StreamCard = ({ stream, username, isBright, isSpeaking }: StreamCardProps) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [fps, setFps] = useState(0);

    // Correction : dfinition de borderClass
    const borderClass = isBright
        ? 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)] ring-2 ring-red-500'
        : isSpeaking 
        ? 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)] ring-1 ring-cyan-500' 
        : 'border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.1)]';

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
        <div className={`relative aspect-video rounded-xl overflow-hidden bg-[#050511] border transition-all duration-500 hover:scale-[1.02] ${borderClass} group`}>
            <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/20 via-transparent to-transparent pointer-events-none z-10" />
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover relative z-0"
            />

            {/* Badge Voice System */}
            <div className="absolute bottom-3 left-3 bg-[#0a0b14]/80 border border-cyan-500/20 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2.5 z-20 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                <div className={`w-2 h-2 rounded-full transition-colors duration-500 shadow-[0_0_8px_currentColor] ${
                    isBright ? 'bg-red-400 animate-pulse text-red-400' : isSpeaking ? 'bg-cyan-400 animate-pulse text-cyan-400' : 'bg-cyan-500/50 text-cyan-500/50'
                }`} />
                <span className="text-[12px] uppercase tracking-widest font-black text-cyan-50">{username}</span>
            </div>

            {/* Overlay d'alerte si trop lumineux */}
            {isBright && (
                <div className="absolute inset-0 pointer-events-none border-[2px] border-red-500/50 bg-red-500/10 animate-pulse z-20" />
            )}

            {/* Overlay FPS en haut  droite */}
            <div className="absolute top-3 right-3 z-20 bg-[#0a0b14]/80 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded shadow-[0_0_10px_rgba(34,211,238,0.2)] backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {fps} fps
            </div>
        </div>
    );
};