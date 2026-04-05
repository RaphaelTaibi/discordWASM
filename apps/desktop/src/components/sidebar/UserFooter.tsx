import { Headphones, Mic, MicOff, Settings, PhoneOff, LogOut, MonitorUp, MonitorOff } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import UserFooterProps from '../../models/userFooterProps.model';

const NetworkIcon = ({ quality }: { quality: 0 | 1 | 2 | 3 }) => {
    const getColor = () => {
        if (quality === 3) return '#22d3ee'; // cyan-400
        if (quality === 2) return '#f0b232';
        if (quality === 1) return '#f23f42';
        return '#3f3f46'; // zinc-700
    };

    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={getColor()}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-shrink-0 transition-colors duration-300"
        >
            <circle cx="5" cy="19" r="1" opacity={quality > 0 ? 1 : 0.5} />
            <path d="M4 11a9 9 0 0 1 9 9" opacity={quality >= 2 ? 1 : 0.2} />
            <path d="M4 4a16 16 0 0 1 16 16" opacity={quality >= 3 ? 1 : 0.2} />
        </svg>
    );
};

const UserFooter = ({
    username,
    isConnected,
    isMuted,
    onToggleMute,
    isDeafened,
    onToggleDeafen,
    channelId,
    isSpeaking,
    onLeave,
    onLogout,
    onStream,
    isStreaming,
    networkQuality = 3,
    ping = 24,
    averagePing = 24,
    packetLoss = 0,
    updateCheck,
    onOpenSettings,
    avatarUrl,
}: UserFooterProps) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [showPing, setShowPing] = useState(false);
    const [showVoiceDetails, setShowVoiceDetails] = useState(false);
    const [voiceDetailsTab, setVoiceDetailsTab] = useState<'connexion' | 'confidentialité'>('connexion');

    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const voiceDetailsRef = useRef<HTMLDivElement>(null);
    const voiceConnectedRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (buttonRef.current && buttonRef.current.contains(e.target as Node)) {
                return; // Géré par le onClick du bouton
            }
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
            if (showVoiceDetails) {
                if (voiceConnectedRef.current && voiceConnectedRef.current.contains(e.target as Node)) return;
                if (voiceDetailsRef.current && !voiceDetailsRef.current.contains(e.target as Node)) {
                    setShowVoiceDetails(false);
                }
            }
        }
        if (menuOpen || showVoiceDetails) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [menuOpen, showVoiceDetails]);

    const fontStyle = { fontFamily: 'gg sans, "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' };

    const handleSettingsClick = () => {
        if (onOpenSettings) {
            onOpenSettings();
        } else {
            setMenuOpen((v) => !v);
        }
    };

    return (
        <div className="w-full select-none bg-[#0a0b14]/90 backdrop-blur-3xl flex flex-col flex-shrink-0 border-t border-cyan-500/20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-20">
            {channelId && (
                <div className="h-[48px] px-3 flex items-center border-b border-cyan-500/10 relative">
                    {showVoiceDetails && isConnected && (
                        <div
                            ref={voiceDetailsRef}
                            className="absolute bottom-full left-0 mb-3 ml-2 w-[340px] bg-[#050511] rounded-xl shadow-[0_10px_40px_rgba(34,211,238,0.2)] border border-cyan-500/30 z-[100] animate-in fade-in slide-in-from-bottom-2 duration-300"
                        >
                            <div className="p-4 pt-5 pb-3">
                                <h3 className="text-cyan-50 font-bold uppercase tracking-widest text-[16px] mb-4">Voice System Matrix</h3>
                                <div className="flex border-b border-cyan-500/20 mb-4 pb-2">
                                    <button
                                        onClick={() => setVoiceDetailsTab('connexion')}
                                        className={`pb-2 px-1 mr-4 text-[14px] font-medium transition-colors relative ${voiceDetailsTab === 'connexion' ? 'text-cyan-400' : 'text-gray-500 hover:text-cyan-100'}`}
                                    >
                                        Connexion
                                        {voiceDetailsTab === 'connexion' && (
                                            <div className="absolute bottom-[-9px] left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></div>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setVoiceDetailsTab('confidentialité')}
                                        className={`pb-2 px-1 text-[14px] font-medium transition-colors relative ${voiceDetailsTab === 'confidentialité' ? 'text-cyan-400' : 'text-gray-500 hover:text-cyan-100'}`}
                                    >
                                        Confidentialité
                                        {voiceDetailsTab === 'confidentialité' && (
                                            <div className="absolute bottom-[-9px] left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></div>
                                        )}
                                    </button>
                                </div>
                                {voiceDetailsTab === 'connexion' ? (
                                    <div className="text-[14px] text-cyan-100/70" style={fontStyle}>
                                        <div className="mb-1">
                                            <span className="font-semibold text-cyan-500/80 uppercase text-[10px] tracking-wider">Latence moyenne : </span>
                                            <span className="font-bold text-cyan-300">{averagePing} ms</span>
                                        </div>
                                        <div className="mb-1">
                                            <span className="font-semibold text-cyan-500/80 uppercase text-[10px] tracking-wider">Dernière latence : </span>
                                            <span className="font-bold text-cyan-300">{ping} ms</span>
                                        </div>
                                        <div className="mb-4">
                                            <span className="font-semibold text-cyan-500/80 uppercase text-[10px] tracking-wider">Perte de paquets : </span>
                                            <span className="font-bold text-cyan-300">{packetLoss.toFixed(1)} %</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-[14px] text-cyan-100/70" style={fontStyle}>
                                        <p className="leading-relaxed">
                                            La transmission vocale et vidéo n'est pas complètement chiffrée de bout en bout pour le moment sur DiscordWASM. Notre protocole de signalisation est sécurisé, mais l'architecture serveur (SFU) nécessite de déchiffrer les flux média (DTLS/SRTP) en mémoire pour les redistribuer aux autres pairs.
                                        </p>
                                    </div>
                                )}
                            </div>
                            <div className="bg-[#0a0b14] p-3 rounded-b-xl flex items-center justify-between border-t border-cyan-500/20">
                                <div className="flex items-center text-cyan-400 text-[12px] font-semibold">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                    Chiffré de bout en bout
                                </div>
                                <a href="#" className="text-blue-400 hover:text-cyan-300 hover:underline text-[12px] font-medium transition-colors">En savoir plus</a>
                            </div>
                        </div>
                    )}
                    <div 
                        ref={voiceConnectedRef}
                        className="flex items-center flex-1 min-w-0 px-1 py-1 rounded-lg hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/30 cursor-pointer relative group transition-all duration-300"
                        onMouseEnter={() => setShowPing(true)}
                        onMouseLeave={() => setShowPing(false)}
                        onClick={() => setShowVoiceDetails(prev => !prev)}
                    >
                        <NetworkIcon quality={isConnected ? networkQuality : 0} />
                        
                        {showPing && isConnected && (
                            <div className="absolute -top-10 left-0 bg-[#050511] border border-cyan-500/30 text-cyan-300 text-[12px] px-2 py-1 rounded shadow-[0_0_15px_rgba(34,211,238,0.2)] whitespace-nowrap z-50 animate-in fade-in zoom-in duration-150 font-mono">
                                <span className="font-bold">{ping}ms</span>
                                <div className="absolute -bottom-1 left-2 w-2 h-2 bg-[#050511] border-b border-r border-cyan-500/30 rotate-45" />
                            </div>
                        )}

                        <div className="ml-2 flex flex-col min-w-0 leading-tight">
                            <div 
                                className={`text-[12px] font-black uppercase tracking-wider truncate ${isConnected ? 'text-cyan-400' : 'text-gray-500'}`} 
                                style={fontStyle}
                            >
                                {isConnected ? 'Voice Connected' : 'Connecting...'}
                            </div>
                            <div className="text-[10px] text-cyan-500/60 uppercase tracking-widest truncate font-bold" style={fontStyle}>
                                Salon vocal
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button 
                            onClick={onStream}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors border border-transparent ${isStreaming ? 'text-cyan-400 bg-cyan-500/20 border-cyan-500/40 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'text-cyan-100/60 hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-200'}`}
                            title={isStreaming ? "Arrêter le stream" : "Lancer un stream"}
                        >
                            {isStreaming ? <MonitorOff size={16} /> : <MonitorUp size={16} />}
                        </button>
                        <button 
                            onClick={onLeave}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-cyan-100/60 hover:bg-red-500/20 border border-transparent hover:border-red-500/40 hover:text-red-400 hover:shadow-[0_0_10px_rgba(248,113,113,0.3)] transition-colors"
                            title="Quitter le salon"
                        >
                            <PhoneOff size={16} />
                        </button>
                    </div>
                </div>
            )}

            <div className="h-[52px] flex items-center px-2 py-1">
                <div className="flex items-center min-w-0 flex-1 px-1 py-1 rounded-lg hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 cursor-pointer transition-all duration-300">
                    <div className="relative flex-shrink-0">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className={`w-8 h-8 rounded-full object-cover border border-cyan-500/30 transition-all duration-300 ${isSpeaking ? 'ring-2 ring-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : ''}`} />
                        ) : (
                            <div
                                className={`w-8 h-8 rounded-full bg-[#050511] border border-cyan-500/30 flex items-center justify-center text-[14px] font-black text-cyan-200 transition-all duration-300
                                ${isSpeaking ? 'ring-2 ring-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : ''}`}
                            >
                                {username.slice(0, 1).toUpperCase()}
                            </div>
                        )}
                        <div className="absolute -right-0.5 -bottom-0.5 w-3.5 h-3.5 rounded-full bg-cyan-500 border-[3px] border-[#0a0b14] shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    </div>
                    
                    <div className="ml-2 flex flex-col justify-center min-w-0 leading-tight">
                        <div className="text-[12px] font-black uppercase tracking-wider text-cyan-50 truncate" style={fontStyle}>
                            {username}
                        </div>
                        <div className="text-[10px] text-cyan-500/60 uppercase tracking-widest font-bold" style={fontStyle}>
                            En ligne
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-0.5">
                    <button
                        onClick={onToggleMute}
                        disabled={!channelId}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-cyan-100/70 border border-transparent hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-300 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent"
                    >
                        {isMuted ? <MicOff size={16} className="text-red-400" /> : <Mic size={16} />}
                    </button>
                    <button
                        onClick={onToggleDeafen}
                        disabled={!channelId}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-cyan-100/70 border border-transparent hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-300 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent"
                    >
                        <Headphones size={16} className={isDeafened ? 'text-red-400' : ''} />
                    </button>
                    <div className="relative">
                        <button
                            ref={buttonRef}
                            onClick={handleSettingsClick}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg text-cyan-100/70 border hover:bg-cyan-500/10 hover:text-cyan-300 transition-colors ${menuOpen ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'border-transparent hover:border-cyan-500/30'}`}
                        >
                            <Settings size={16} />
                        </button>
                        {menuOpen && (
                            <div ref={menuRef} className="absolute right-0 bottom-full mb-2 w-[220px] bg-[#050511]/95 backdrop-blur-md rounded-xl shadow-[0_0_30px_rgba(34,211,238,0.15)] py-2 px-2 z-50 border border-cyan-500/30">
                                <button onClick={updateCheck} className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-bold tracking-wide uppercase text-cyan-100/80 rounded-lg hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors mb-1" style={fontStyle}>
                                    System Update
                                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" className="text-cyan-400"><path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                                </button>
                                <div className="h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent my-1" />
                                <button onClick={onLogout} className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-bold tracking-wide uppercase text-red-500/80 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors" style={fontStyle}>
                                    Disconnect
                                    <LogOut size={14} className="text-red-400" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserFooter;
