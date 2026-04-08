import { useEffect, useRef } from 'react';
import { MicOff, Headphones, Eye, Camera } from 'lucide-react';
import VoiceTileProps from '../../models/voiceTileProps.model';

/**
 * Single participant tile in the voice grid.
 * Displays video/screen stream or avatar fallback, with status icons.
 */
export const VoiceTile = ({
    username,
    isSpeaking,
    isMuted,
    isDeafened,
    videoStream,
    screenStream,
    avatarUrl,
    isLocal,
    isSpotlighted,
    isWatchingSpotlight,
    onClick,
}: VoiceTileProps) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const _activeStream = screenStream ?? videoStream;
    const _hasVideo = !!_activeStream;
    const _initial = username.slice(0, 1).toUpperCase();

    useEffect(() => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = _activeStream;
        if (_activeStream) {
            void videoRef.current.play().catch(() => {});
        }
    }, [_activeStream]);

    const _speakingRing = isSpeaking
        ? 'ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)]'
        : '';

    const _hasStream = !!screenStream;
    const _cursorClass = _hasStream ? 'cursor-pointer' : 'cursor-default';

    return (
        <div
            onClick={_hasStream ? onClick : undefined}
            className={`relative rounded-xl overflow-hidden transition-all duration-300 group ${_speakingRing} ${isSpotlighted ? 'col-span-full' : ''} ${_hasVideo ? 'bg-[#050511] border border-cyan-500/20' : 'glass-heavy border-cyan-500/20'} ${_cursorClass} ${_hasStream ? 'hover:border-cyan-500/40' : ''}`}
            style={{ aspectRatio: isSpotlighted ? undefined : '16/9' }}
        >
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none z-10" />

            {_hasVideo ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isLocal}
                    className="w-full h-full object-cover"
                />
            ) : (
                <AvatarFallback
                    initial={_initial}
                    avatarUrl={avatarUrl}
                    isSpeaking={isSpeaking}
                />
            )}

            {/* Bottom-left badge: username + status icons */}
            <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-[#0a0b14]/80 border border-cyan-500/20 backdrop-blur-md px-2.5 py-1 rounded-lg z-20 shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                <div className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-300 shadow-[0_0_6px_currentColor] ${
                    isSpeaking ? 'bg-cyan-400 animate-pulse text-cyan-400' : 'bg-cyan-500/40 text-cyan-500/40'
                }`} />
                <span className="text-[11px] uppercase tracking-widest font-black text-cyan-50 truncate max-w-[100px]">
                    {username}
                </span>
                {isDeafened && <Headphones size={12} className="text-red-400/70 shrink-0" />}
                {(isMuted || isDeafened) && <MicOff size={12} className="text-red-400/70 shrink-0" />}
                {isLocal && screenStream && <Camera size={12} className="text-cyan-400 shrink-0" />}
            </div>

            {/* Top-right: eye icon for watchers */}
            {isWatchingSpotlight && (
                <div className="absolute top-2 right-2 z-20 bg-[#0a0b14]/70 border border-cyan-500/20 backdrop-blur-md p-1.5 rounded-md">
                    <Eye size={14} className="text-cyan-400" />
                </div>
            )}
        </div>
    );
};

/** Centered avatar with speaking pulse when no video is available. */
const AvatarFallback = ({
    initial,
    avatarUrl,
    isSpeaking,
}: {
    initial: string;
    avatarUrl: string | null;
    isSpeaking: boolean;
}) => (
    <div className="w-full h-full flex items-center justify-center">
        <div className={`w-20 h-20 rounded-full bg-[#0a0b14] flex items-center justify-center border-2 transition-all duration-300 overflow-hidden ${
            isSpeaking
                ? 'border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.5)] scale-105'
                : 'border-cyan-500/30'
        }`}>
            {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
                <span className="text-2xl font-black text-cyan-100/60">{initial}</span>
            )}
        </div>
    </div>
);

