import { Headphones, MicOff, Volume2 } from 'lucide-react';
import MembersPanelProps from '../../models/membersPanelProps.model';

export const MembersPanel = ({
    participants,
    isConnected,
    channelId,
    speakingUsers,
}: MembersPanelProps) => (
    <div className="h-full flex flex-col">
        <div className="h-12 px-4 flex items-center border-b border-black/20 text-sm font-semibold text-gray-200">
            Membres vocaux
        </div>
        <div className="px-4 py-3 text-xs text-gray-400 border-b border-black/20">
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

                return (
                    <div
                        key={member.userId}
                        className="flex items-center gap-2 bg-[#35373c] rounded-md px-3 py-2 transition-all duration-200 hover:bg-[#3f4147] animate-[fadeIn_0.2s_ease-out]"
                    >
                        <div className={`w-7 h-7 rounded-full bg-[#5865f2] text-white text-xs font-bold flex items-center justify-center transition-all duration-300 ${
                            isSpeaking ? 'ring-2 ring-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : ''
                        }`}>
                            {member.username.slice(0, 1).toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-100 truncate flex-1">{member.username}</span>
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
    </div>
);


