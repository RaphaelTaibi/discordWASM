import { MicOff, Headphones } from 'lucide-react';
import VoiceParticipantCardProps from '../../models/voiceParticipantCardProps.model';

/**
 * Compact card for a voice participant displayed under the channel name in the sidebar.
 * Shows avatar, username, mute/deafen icons, and a VAD wave animation when speaking.
 */
export const VoiceParticipantCard = ({
    username,
    isMuted = false,
    isDeafened = false,
    isSpeaking = false,
    avatarUrl,
}: VoiceParticipantCardProps) => {
    const _initial = username.slice(0, 1).toUpperCase();

    return (
        <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-cyan-100/70 hover:bg-[#0a0b14] hover:text-cyan-100 border border-transparent hover:border-cyan-500/30 transition-all duration-300 cursor-pointer">
            {/* Avatar */}
            <div className={`relative w-7 h-7 rounded-full bg-[#050511] flex items-center justify-center text-[11px] font-black border border-cyan-500/30 shrink-0 transition-all duration-300 overflow-hidden ${
                isSpeaking ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-[#050511] shadow-[0_0_15px_rgba(34,211,238,0.5)] text-cyan-200' : 'text-cyan-100/60'
            }`}>
                {avatarUrl ? (
                    <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
                ) : (
                    _initial
                )}
            </div>

            {/* Username + VAD wave */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-[12px] font-bold tracking-wide truncate">{username}</span>
                {isSpeaking && <VadWave />}
            </div>

            {/* State icons */}
            <div className="flex items-center gap-1 shrink-0">
                {isDeafened && <Headphones size={13} className="text-red-400/70" />}
                {(isMuted || isDeafened) && <MicOff size={13} className="text-red-400/70" />}
            </div>
        </div>
    );
};

/** Animated sound wave bars indicating voice activity. */
const VadWave = () => (
    <div className="flex items-center gap-[2px] h-3">
        <span className="w-[2px] bg-cyan-400 rounded-full animate-vad-bar-1" />
        <span className="w-[2px] bg-cyan-400 rounded-full animate-vad-bar-2" />
        <span className="w-[2px] bg-cyan-400 rounded-full animate-vad-bar-3" />
    </div>
);

