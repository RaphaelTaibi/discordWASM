import { Hash, Headphones, MicOff, Timer, Volume2, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import SidebarContentProps from '../../models/sidebarContentProps.model';
import { useVoiceStore } from '../../context/VoiceContext';
import { UserContextMenu } from '../ui/UserContextMenu';

const ChannelTimer = ({ isActive, startedAt }: { isActive: boolean; startedAt?: number }) => {
    const [seconds, setSeconds] = useState(0);
    useEffect(() => {
        let interval: number | undefined;
        
        const updateTime = () => {
            if (startedAt && startedAt > 0) {
                // Handle case where startedAt might be in seconds vs milliseconds
                const now = Date.now();
                const startMs = startedAt < 20000000000 ? startedAt * 1000 : startedAt;
                setSeconds(Math.max(0, Math.floor((now - startMs) / 1000)));
            } else {
                setSeconds((s) => s + 1);
            }
        };

        if (isActive) {
            updateTime();
            interval = window.setInterval(updateTime, 1000);
        } else {
            setSeconds(0);
        }
        return () => clearInterval(interval);
    }, [isActive, startedAt]);
    if (!isActive) return null;
    const formatTime = (ts: number) => {
        const m = Math.floor((ts % 3600) / 60), s = ts % 60;
        return [m, s].map((v) => v.toString().padStart(2, '0')).join(':');
    };
    return (
        <div className="flex items-center gap-1 text-[11px] font-mono text-cyan-400 bg-cyan-900/30 px-1.5 py-0.5 rounded ml-1 border border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)] tracking-wider">
            <Timer size={10} className="animate-pulse" />
            {formatTime(seconds)}
        </div>
    );
};

export const SidebarContent = ({
    channelId,
    onJoin,
    salons,
    localUserId,
    activeView,
    onViewChange,
    speakingUsers,
    channelStartedAt
}: SidebarContentProps) => {
    const { userVolumes, setUserVolume, voiceAvatar } = useVoiceStore();
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, userId: string, username: string } | null>(null);

    const handleContextMenu = (e: React.MouseEvent, userId: string, username: string) => {
        if (userId === localUserId) return;
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            userId,
            username
        });
    };

    return (
        <div className="flex flex-col h-full bg-transparent select-none relative z-10">
            {/* Salons Vocaux */}
            <div className="pt-4 pb-2 px-4 font-black text-cyan-500/70 uppercase text-[10px] tracking-widest select-none flex items-center justify-between">
                SYS.CHANNELS
                <div className="flex gap-2">
                    <button className="text-cyan-600 hover:text-cyan-400 transition-colors hidden group-hover:block" title="Créer un salon">
                        <Plus size={14} />
                    </button>
                    <Volume2 size={12} className="text-cyan-600/50" />
                </div>
            </div>
            <div className="px-2 space-y-1 mb-4 flex-1">
                {salons.map((salon) => (
                    <div key={salon.id} className="mb-1 relative z-10 group/channel">
                        <div className="absolute inset-0 bg-linear-to-r from-cyan-500/10 to-transparent opacity-0 transition-opacity duration-300 group-hover/channel:opacity-100 rounded-lg pointer-events-none" />
                        <button
                            onClick={() => {
                                onJoin(salon.id);
                                onViewChange('voice');
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-[13px] font-bold tracking-wide transition-all duration-300 relative z-10
                                ${(channelId === salon.id && activeView === 'voice') 
                                    ? 'bg-cyan-500/20 text-cyan-100 shadow-[0_0_15px_rgba(34,211,238,0.15)] border border-cyan-400/30' 
                                    : 'text-cyan-100/60 hover:text-cyan-200 border border-transparent'}
                            `}
                        >
                            <div className="flex items-center gap-2.5 truncate">
                                <Volume2 size={16} className={`${(channelId === salon.id && activeView === 'voice') ? 'text-cyan-400' : 'text-cyan-600/70 group-hover/channel:text-cyan-400/80 transition-colors'}`} />
                                <span className="truncate">{salon.name}</span>
                            </div>
                            
                            {(channelId === salon.id && channelStartedAt) && (
                                <ChannelTimer startedAt={channelStartedAt} isActive={true} />
                            )}
                        </button>

                        {(channelId === salon.id && salon.members.length > 0) && (
                            <div className="mt-1.5 ml-8 pl-3 border-l border-cyan-500/30 pb-2 space-y-1 relative before:absolute before:top-0 before:left-0 before:w-px before:h-8 before:bg-linear-to-b before:from-cyan-400 before:to-transparent">
                                {salon.members.map((member) => {
                                    const isSpeaking = speakingUsers?.get(member.userId);
                                    return (
                                        <div 
                                            key={member.userId} 
                                            onContextMenu={(e) => handleContextMenu(e, member.userId, member.username)}
                                            className={`group/member w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-cyan-500/10 transition-all duration-300 cursor-pointer border border-transparent hover:border-cyan-500/20 ${isSpeaking ? 'bg-cyan-900/20' : ''}`}
                                        >
                                            <div className="flex items-center gap-2.5 truncate">
                                                <div className="relative">
                                                    {(member.userId === localUserId && voiceAvatar) ? (
                                                        <img 
                                                            src={voiceAvatar} 
                                                            alt={member.username} 
                                                            className={`w-6 h-6 rounded-full object-cover border border-cyan-500/30 transition-all duration-300 ${isSpeaking ? 'ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]' : ''}`} 
                                                        />
                                                    ) : (
                                                        <div className={`w-6 h-6 rounded-full bg-[#050511] flex items-center justify-center text-cyan-200 text-[10px] font-black border border-cyan-500/30 transition-all duration-300 
                                                            ${isSpeaking ? 'ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]' : ''}`}>
                                                            {member.username.slice(0,1).toUpperCase()}
                                                        </div>
                                                    )}
                                                    {member.isDeafened ? (
                                                        <div className="absolute -bottom-1 -right-1 bg-[#050511] rounded-full p-0.5 border border-cyan-500/30">
                                                            <Headphones size={8} className="text-red-400" />
                                                        </div>
                                                    ) : member.isMuted ? (
                                                        <div className="absolute -bottom-1 -right-1 bg-[#050511] rounded-full p-0.5 border border-cyan-500/30">
                                                            <MicOff size={8} className="text-red-400" />
                                                        </div>
                                                    ) : null}
                                                </div>
                                                <span className={`text-[12px] truncate transition-colors duration-300 font-bold tracking-wide ${isSpeaking ? 'text-cyan-300' : 'text-cyan-100/70 group-hover/member:text-cyan-200'}`}>
                                                    {member.username}
                                                </span>
                                            </div>
                                            {isSpeaking && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Canaux Texte */}
            <div className="pt-3 pb-1 px-4 font-bold text-cyan-500/70 uppercase text-[10px] tracking-widest select-none flex items-center justify-between">
                SYS.TEXT
                <div className="flex gap-2">
                    <button className="text-cyan-600 hover:text-cyan-400 transition-colors hidden group-hover:block" title="Créer un salon">
                        <Plus size={14} />
                    </button>
                    <Hash size={12} className="text-cyan-600/50" />
                </div>
            </div>
            <div className="px-2 space-y-0.5 overflow-y-auto overflow-x-hidden custom-scrollbar">
                <button 
                    onClick={() => onViewChange('chat')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-[13px] font-bold tracking-wide transition-all duration-300 relative z-10
                        ${activeView === 'chat' 
                            ? 'bg-cyan-500/20 text-cyan-100 shadow-[0_0_15px_rgba(34,211,238,0.15)] border border-cyan-400/30' 
                            : 'text-cyan-100/60 hover:text-cyan-200 border border-transparent'}
                    `}
                >
                    <div className="flex items-center gap-2.5 truncate">
                        <Hash size={16} className={`${activeView === 'chat' ? 'text-cyan-400' : 'text-cyan-600/70 group-hover:text-cyan-400/80 transition-colors'}`} />
                        <span className="truncate">chat-system</span>
                    </div>
                </button>
            </div>

            {contextMenu && (
                <UserContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    userId={contextMenu.userId}
                    username={contextMenu.username}
                    volume={userVolumes.get(contextMenu.userId) ?? 1}
                    onVolumeChange={(vol) => setUserVolume(contextMenu.userId, vol)}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div>
    );
};
