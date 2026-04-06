import { Headphones, MicOff, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { useVoiceStore } from '../../context/VoiceContext';
import MembersPanelProps from '../../models/membersPanelProps.model';
import { UserContextMenu } from '../ui/UserContextMenu';
import { identityTag } from '../../lib/identity-tag';

export const MembersPanel = ({
    participants,
    isConnected,
    channelId,
    speakingUsers,
}: MembersPanelProps) => {
    const { localUserId, userVolumes, setUserVolume, voiceAvatar } = useVoiceStore();
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
        <div className="h-full flex flex-col glass-heavy border-l border-white/[0.06]">
            <div className="h-12 px-4 flex items-center border-b border-white/[0.06] text-[10px] font-black text-cyan-500/60 uppercase tracking-widest">
                Membres vocaux
            </div>
            <div className="px-4 py-2 text-[11px] text-cyan-500/40 border-b border-white/[0.06] font-medium">
                {isConnected ? `Connecté sur ${channelId}` : 'Aucune connexion vocale'}
            </div>
            <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                {participants.length === 0 && (
                    <div className="text-[11px] text-cyan-500/30 font-medium">Personne dans le salon pour le moment.</div>
                )}
                {participants.map((member) => {
                    const memberMuted = !!member.isMuted;
                    const memberDeafened = !!member.isDeafened;
                    const isSpeaking = speakingUsers?.get(member.userId) ?? false;

                    return (
                        <div
                            key={member.userId}
                            onContextMenu={(e) => handleContextMenu(e, member.userId, member.username)}
                            className={`flex items-center gap-2 glass-light rounded-lg px-3 py-2 transition-all duration-200 hover:bg-white/[0.06] animate-[fadeIn_0.2s_ease-out] hover:border-cyan-500/20 ${isSpeaking ? 'ring-1 ring-cyan-400/60 shadow-[0_0_12px_rgba(34,211,238,0.15)]' : ''}`}
                        >
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-cyan-600/40 to-purple-600/40 text-cyan-50 text-sm font-bold flex items-center justify-center transition-all duration-300 relative overflow-hidden border border-white/[0.08] ${
                                isSpeaking ? 'ring-1 ring-cyan-400/60 shadow-[0_0_10px_rgba(34,211,238,0.4)]' : ''
                            }`}>
                                {(member.userId === localUserId && voiceAvatar) ? (
                                    <img src={voiceAvatar} alt={member.username} className="w-full h-full object-cover" />
                                ) : (
                                    member.username.slice(0, 1).toUpperCase()
                                )}
                            </div>
                            <span className="text-[13px] text-cyan-100/80 truncate flex-1 font-medium">
                                {member.username}
                                <span className="text-cyan-500/40 text-[10px] ml-1 font-mono">#{identityTag(member.userId)}</span>
                            </span>
                            <div className="inline-flex items-center gap-1">
                                {memberDeafened && (
                                    <span className="text-[10px] uppercase font-bold text-orange-300 inline-flex items-center gap-0.5">
                                        <Headphones size={12} />
                                    </span>
                                )}
                                <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold ${memberMuted ? 'text-rose-400/80' : 'text-cyan-400/80'}`}>
                                    {memberMuted ? <MicOff size={12} /> : <Volume2 size={12} />}
                                    {memberMuted ? 'Mute' : 'Live'}
                                </span>
                            </div>
                        </div>
                    );
                })}
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
