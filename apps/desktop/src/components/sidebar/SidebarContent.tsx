import { Hash, Headphones, MicOff, Timer, Volume2 } from 'lucide-react';
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
        <div className="flex items-center gap-1 text-[11px] font-mono text-[#23a55a] bg-[#23a55a]/10 px-1.5 py-0.5 rounded-sm ml-1 border border-[#23a55a]/20">
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
    const { userVolumes, setUserVolume } = useVoiceStore();
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
        <div className="flex flex-col h-full bg-[#2b2d31] select-none">
            {/* Salons Vocaux */}
            <div className="pt-3 pb-1 px-4 font-bold text-[#949ba4] uppercase text-[11px] tracking-wider select-none flex items-center justify-between">
                Salons vocaux
                <Volume2 size={12} className="text-[#949ba4]" />
            </div>
            <div className="px-2 space-y-0.5 mb-4">
                {salons.map((salon) => (
                    <div key={salon.id} className="mb-1">
                        <button
                            onClick={() => {
                                onJoin(salon.id);
                                onViewChange('voice');
                            }}
                            className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left text-[15px] font-medium transition-colors duration-100 group
                                ${(channelId === salon.id && activeView === 'voice') ? 'bg-[#404249] text-white' : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'}
                            `}
                        >
                            <Volume2 size={20} className="text-[#80848e]" />
                            <span className="truncate flex-1">{salon.name}</span>
                            <ChannelTimer isActive={salon.members.length > 0} startedAt={channelId === salon.id ? channelStartedAt : undefined} />
                        </button>

                        {(channelId === salon.id) && (
                            <div className="pl-8 mt-0.5 space-y-0.5">
                                {salon.members.map((member) => (
                                    <div 
                                        key={member.userId} 
                                        onContextMenu={(e) => handleContextMenu(e, member.userId, member.username)}
                                        className="flex items-center gap-2 py-1 group rounded-[4px] px-2 hover:bg-[#35373c] cursor-pointer"
                                    >
                                        <div className={`w-6 h-6 rounded-full bg-[#5865f2] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 relative
                                            ${speakingUsers?.get(member.userId) ? 'ring-2 ring-[#23a55a]' : ''}
                                        `}>
                                            {member.username.slice(0, 1).toUpperCase()}
                                        </div>
                                        <span className="text-[14px] text-[#949ba4] group-hover:text-[#dbdee1] truncate flex-1 font-medium">{member.username}</span>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            {member.isDeafened ? (
                                                <div className="flex items-center gap-1">
                                                    <span title="Muet"><MicOff size={14} className="text-[#f23f42]" /></span>
                                                    <span title="Sourdine"><Headphones size={14} className="text-[#f23f42]" /></span>
                                                </div>
                                            ) : member.isMuted ? (
                                                <span title="Muet"><MicOff size={14} className="text-[#f23f42]" /></span>
                                            ) : (
                                                <span className="text-[#23a55a] text-[10px] font-bold px-1 bg-[#23a55a]/10 rounded-sm uppercase">LIVE</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Canaux Texte */}
            <div className="pt-3 pb-1 px-4 font-bold text-[#949ba4] uppercase text-[11px] tracking-wider select-none">
                Canaux texte
            </div>
            <div className="px-2 space-y-0.5 overflow-y-auto overflow-x-hidden custom-scrollbar">
                <button 
                    onClick={() => onViewChange('chat')}
                    className={`w-full flex items-center gap-1.5 text-left text-[15px] px-2 py-1.5 rounded-md transition-colors duration-100 group
                        ${activeView === 'chat' ? 'bg-[#404249] text-white' : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'}
                    `}
                >
                    <Hash size={20} className="text-[#80848e]" />
                    chat-general
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
