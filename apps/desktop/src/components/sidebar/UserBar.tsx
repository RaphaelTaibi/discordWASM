import { Headphones, Mic, MicOff, Settings } from 'lucide-react';
import UserBarProps from '../../models/userBarProps.model';

export const UserBar = ({
    username,
    isConnected,
    isMuted,
    onToggleMute,
    isDeafened,
    onToggleDeafen,
    channelId,
    isSpeaking,
}: UserBarProps) => (
    <div className="w-full flex items-center gap-2">
        <div className={`relative w-8 h-8 rounded-full bg-[#5865f2] flex items-center justify-center text-xs font-bold text-white transition-all duration-300 ${
            isSpeaking ? 'ring-2 ring-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : ''
        }`}>
            {username.slice(0, 1).toUpperCase()}
            {isDeafened && (
                <span className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full bg-red-500 border-2 border-[#232428] inline-flex items-center justify-center">
                    <Headphones size={9} className="text-white" />
                </span>
            )}
        </div>
        {isDeafened && <span className="sr-only">Son entrant coupé</span>}
        <div className="flex-1 min-w-0">
            <div className="text-sm text-white truncate font-semibold">{username}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">
                {isConnected ? (isMuted ? 'En vocal - muté' : 'En vocal') : 'Hors vocal'}
            </div>
        </div>
        <div className="flex items-center gap-1">
            <button
                onClick={onToggleMute}
                disabled={!channelId}
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                aria-pressed={isMuted}
                className="w-7 h-7 rounded bg-[#3f4147] hover:bg-[#4a4d55] disabled:opacity-50 inline-flex items-center justify-center cursor-pointer transition-all duration-100 active:scale-90"
            >
                {isMuted ? <MicOff size={14} className="text-red-300" /> : <Mic size={14} className="text-gray-200" />}
            </button>
            <button
                onClick={onToggleDeafen}
                disabled={!channelId}
                title={isDeafened ? 'Activer le son entrant' : 'Couper le son entrant'}
                aria-label={isDeafened ? 'Activer le son entrant' : 'Couper le son entrant'}
                aria-pressed={isDeafened}
                className="w-7 h-7 rounded bg-[#3f4147] hover:bg-[#4a4d55] disabled:opacity-50 inline-flex items-center justify-center cursor-pointer transition-all duration-100 active:scale-90"
            >
                <Headphones size={14} className={isDeafened ? 'text-red-300' : 'text-gray-200'} />
            </button>
            <button className="w-7 h-7 rounded bg-[#3f4147] hover:bg-[#4a4d55] inline-flex items-center justify-center cursor-pointer transition-all duration-100 active:scale-90">
                <Settings size={14} className="text-gray-200" />
            </button>
        </div>
    </div>
);


