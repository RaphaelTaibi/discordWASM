import { Headphones, MicOff, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { useVoiceStore } from '../../context/VoiceContext';
import MembersPanelProps from '../../models/membersPanelProps.model';
import { UserContextMenu } from '../ui/UserContextMenu';

export const MembersPanel = ({
    participants,
    isConnected,
    channelId,
    speakingUsers,
}: MembersPanelProps) => {
    const { localUserId, userVolumes, setUserVolume } = useVoiceStore();
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
        <div className="h-full flex flex-col bg-[#232428] border-l border-black/20">
            <div className="h-12 px-4 flex items-center border-b border-black/20 text-xs font-bold text-gray-300 uppercase tracking-wider">
                Membres vocaux
            </div>
            <div className="px-4 py-2 text-[11px] text-gray-400 border-b border-black/20">
                {isConnected ? `Connecté sur ${channelId}` : 'Aucune connexion vocale'}
            </div>
            <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                {participants.length === 0 && (
                    <div className="text-xs text-gray-500">Personne dans le salon pour le moment.</div>
                )}
                {participants.map((member) => {
                    const memberMuted = !!member.isMuted;
                    const memberDeafened = !!member.isDeafened;
                    const isSpeaking = speakingUsers?.get(member.userId) ?? false;
                    const volume = userVolumes.get(member.userId) ?? 1;

                    return (
                        <div
                            key={member.userId}
                            onContextMenu={(e) => handleContextMenu(e, member.userId, member.username)}
                            className={`flex items-center gap-2 bg-[#35373c] rounded-lg px-3 py-2 transition-all duration-200 hover:bg-[#404249] animate-[fadeIn_0.2s_ease-out] border border-transparent hover:border-[#5865f2] ${isSpeaking ? 'ring-2 ring-green-500' : ''}`}
                        >
                            <div className={`w-8 h-8 rounded-full bg-[#5865f2] text-white text-sm font-bold flex items-center justify-center transition-all duration-300 ${
                                isSpeaking ? 'ring-2 ring-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : ''
                            }`}>
                                {member.username.slice(0, 1).toUpperCase()}
                            </div>
                            <span className="text-[13px] text-gray-100 truncate flex-1 font-medium">{member.username}</span>
                            <div className="inline-flex items-center gap-1">
                                {memberDeafened && (
                                    <span className="text-[10px] uppercase font-bold text-orange-300 inline-flex items-center gap-0.5">
                                        <Headphones size={12} />
                                    </span>
                                )}
                                <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold ${memberMuted ? 'text-red-300' : 'text-green-300'}`}>
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
