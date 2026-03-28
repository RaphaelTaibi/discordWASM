import { Hash, Headphones, LogOut, Mic, MicOff, PhoneOff } from 'lucide-react';
import SidebarContentProps from '../../models/sidebarContentProps.model';

export const SidebarContent = ({
    channelId,
    isConnected,
    isMuted,
    isDeafened,
    error,
    onJoin,
    onLeave,
    onToggleMute,
    onToggleDeafen,
    onLogout,
}: SidebarContentProps) => (
    <div className="flex flex-col h-full bg-[#2b2d31]">
        <div className="p-4 font-bold text-gray-400 uppercase text-[12px] tracking-wider">
            Salons Vocaux
        </div>

        <div className="px-2 space-y-2">
            <button
                onClick={() => onJoin('general')}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-white cursor-pointer transition-colors duration-150 ${
                    channelId === 'general' ? 'bg-[#5865f2]' : 'bg-[#35373c] hover:bg-[#3f4147]'
                }`}
            >
                <Hash size={16} className="text-gray-300" />
                General
            </button>
            <button
                onClick={() => onJoin('sos')}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-white cursor-pointer transition-colors duration-150 ${
                    channelId === 'sos' ? 'bg-[#5865f2]' : 'bg-[#35373c] hover:bg-[#3f4147]'
                }`}
            >
                <Hash size={16} className="text-gray-300" />
                SOS
            </button>
        </div>

        <div className="px-4 py-3 text-xs text-gray-300 space-y-1 border-b border-black/10 mt-3">
            <div className="flex items-center gap-1.5">
                État: {isConnected ? (
                    <>
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                        </span>
                        Connecté
                    </>
                ) : 'Hors ligne'}
            </div>
            <div>Canal: {channelId ?? 'Aucun'}</div>
            <div>Micro: {isMuted ? 'Muté' : 'Actif'}</div>
            <div>Son entrant: {isDeafened ? 'Coupé' : 'Actif'}</div>
            {error && <div className="text-red-400">Erreur: {error}</div>}
        </div>

        <div className="px-2 mt-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 px-2 mb-2">Canaux texte</div>
            <button className="w-full flex items-center gap-2 text-left text-sm text-gray-300 px-2 py-1 rounded hover:bg-[#3f4147] transition-colors duration-150">
                <Hash size={14} className="text-gray-400" />
                annonces
            </button>
            <button className="w-full flex items-center gap-2 text-left text-sm text-gray-300 px-2 py-1 rounded hover:bg-[#3f4147] transition-colors duration-150">
                <Hash size={14} className="text-gray-400" />
                logs
            </button>
        </div>

        <div className="flex-1" />

        <div className="p-4 border-t border-black/10">
            <div className="flex gap-2 mb-3">
                <button
                    onClick={onToggleMute}
                    disabled={!channelId}
                    title={isMuted ? 'Unmute' : 'Mute'}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                    aria-pressed={isMuted}
                    className="w-9 h-9 rounded-full bg-[#35373c] hover:bg-[#3f4147] disabled:opacity-50 cursor-pointer inline-flex items-center justify-center transition-all duration-150 active:scale-90"
                >
                    {isMuted ? <MicOff size={16} className="text-red-300" /> : <Mic size={16} className="text-gray-100" />}
                </button>
                <button
                    onClick={onToggleDeafen}
                    disabled={!channelId}
                    title={isDeafened ? 'Activer le son entrant' : 'Couper le son entrant'}
                    aria-label={isDeafened ? 'Activer le son entrant' : 'Couper le son entrant'}
                    aria-pressed={isDeafened}
                    className="w-9 h-9 rounded-full bg-[#35373c] hover:bg-[#3f4147] disabled:opacity-50 cursor-pointer inline-flex items-center justify-center transition-all duration-150 active:scale-90"
                >
                    <Headphones size={16} className={isDeafened ? 'text-red-300' : 'text-gray-100'} />
                </button>
                <button
                    onClick={onLeave}
                    disabled={!channelId}
                    className="flex-1 text-xs px-2 py-2 rounded bg-red-500/90 hover:bg-red-500 disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-1 transition-all duration-150 active:scale-95"
                >
                    <PhoneOff size={14} />
                    Quitter
                </button>
            </div>

            <button
                onClick={onLogout}
                className="text-xs text-red-400 hover:text-red-300 hover:underline cursor-pointer inline-flex items-center gap-1 transition-colors duration-150"
            >
                <LogOut size={14} />
                Se déconnecter
            </button>
        </div>
    </div>
);


