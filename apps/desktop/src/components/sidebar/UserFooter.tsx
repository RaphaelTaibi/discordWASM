import { Headphones, Mic, MicOff, Settings, PhoneOff, LogOut, MonitorUp, MonitorOff } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import UserFooterProps from '../../models/userFooterProps.model';

const NetworkIcon = ({ quality }: { quality: 0 | 1 | 2 | 3 }) => {
    const getColor = () => {
        if (quality === 3) return '#23a55a';
        if (quality === 2) return '#f0b232';
        if (quality === 1) return '#f23f42';
        return '#80848e';
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
    updateCheck,
}: UserFooterProps) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [showPing, setShowPing] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        }
        if (menuOpen) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [menuOpen]);

    const fontStyle = { fontFamily: 'gg sans, "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' };

    return (
        <div className="w-full select-none bg-[#232428] flex flex-col flex-shrink-0 border-t border-black/10">
            {channelId && (
                <div className="h-[48px] px-2 flex items-center border-b border-white/[0.04]">
                    <div 
                        className="flex items-center flex-1 min-w-0 px-1 py-1 rounded-[4px] hover:bg-[#35373c] cursor-pointer relative group"
                        onMouseEnter={() => setShowPing(true)}
                        onMouseLeave={() => setShowPing(false)}
                    >
                        <NetworkIcon quality={isConnected ? networkQuality : 0} />
                        
                        {showPing && isConnected && (
                            <div className="absolute -top-10 left-0 bg-[#111214] text-white text-[12px] px-2 py-1 rounded-[4px] shadow-xl whitespace-nowrap z-50 animate-in fade-in zoom-in duration-150">
                                <span className="font-bold">{ping}ms</span>
                                <div className="absolute -bottom-1 left-2 w-2 h-2 bg-[#111214] rotate-45" />
                            </div>
                        )}

                        <div className="ml-2 flex flex-col min-w-0 leading-tight">
                            <div 
                                className={`text-[14px] font-bold truncate ${isConnected ? 'text-[#23a55a]' : 'text-[#80848e]'}`} 
                                style={fontStyle}
                            >
                                {isConnected ? 'Voice Connected' : 'Connecting...'}
                            </div>
                            <div className="text-[12px] text-[#b5bac1] truncate" style={fontStyle}>
                                Salon vocal
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button 
                            onClick={onStream}
                            className={`w-8 h-8 flex items-center justify-center rounded-[4px] transition-colors ${isStreaming ? 'text-[#23a55a] bg-[#23a55a]/10 hover:bg-[#23a55a]/20' : 'text-[#dbdee1] hover:bg-[#35373c] hover:text-[#f2f3f5]'}`}
                            title={isStreaming ? "Arrêter le stream" : "Lancer un stream"}
                        >
                            {isStreaming ? <MonitorOff size={20} /> : <MonitorUp size={20} />}
                        </button>
                        <button 
                            onClick={onLeave}
                            className="w-8 h-8 flex items-center justify-center rounded-[4px] text-[#dbdee1] hover:bg-[#35373c] hover:text-[#ed4245] transition-colors"
                            title="Quitter le salon"
                        >
                            <PhoneOff size={20} />
                        </button>
                    </div>
                </div>
            )}

            <div className="h-[52px] flex items-center px-2">
                <div className="flex items-center min-w-0 flex-1 px-1 py-1 rounded-[4px] hover:bg-[#35373c] cursor-pointer transition-colors duration-150">
                    <div className="relative flex-shrink-0">
                        <div
                            className={`w-8 h-8 rounded-full bg-[#5865f2] flex items-center justify-center text-[14px] font-bold text-white transition-all duration-300
                            ${isSpeaking ? 'ring-2 ring-[#248046]' : ''}`}
                        >
                            {username.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="absolute -right-0.5 -bottom-0.5 w-3.5 h-3.5 rounded-full bg-[#23a55a] border-[3px] border-[#232428]" />
                    </div>
                    
                    <div className="ml-2 flex flex-col justify-center min-w-0 leading-tight">
                        <div className="text-[14px] font-semibold text-[#f2f3f5] truncate" style={fontStyle}>
                            {username}
                        </div>
                        <div className="text-[12px] text-[#b5bac1] font-normal" style={fontStyle}>
                            En ligne
                        </div>
                    </div>
                </div>

                <div className="flex items-center">
                    <button
                        onClick={onToggleMute}
                        disabled={!channelId}
                        className="w-8 h-8 flex items-center justify-center rounded-[4px] text-[#dbdee1] hover:bg-[#35373c] hover:text-[#f2f3f5] transition-colors"
                    >
                        {isMuted ? <MicOff size={20} className="text-[#fa777c]" /> : <Mic size={20} />}
                    </button>
                    <button
                        onClick={onToggleDeafen}
                        disabled={!channelId}
                        className="w-8 h-8 flex items-center justify-center rounded-[4px] text-[#dbdee1] hover:bg-[#35373c] hover:text-[#f2f3f5] transition-colors"
                    >
                        <Headphones size={20} className={isDeafened ? 'text-[#fa777c]' : ''} />
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setMenuOpen((v) => !v)}
                            className={`w-8 h-8 flex items-center justify-center rounded-[4px] text-[#dbdee1] hover:bg-[#35373c] hover:text-[#f2f3f5] transition-colors ${menuOpen ? 'bg-[#35373c] text-[#f2f3f5]' : ''}`}
                        >
                            <Settings size={20} />
                        </button>
                        {menuOpen && (
                            <div ref={menuRef} className="absolute right-0 bottom-[48px] mb-2 w-[220px] bg-[#111214] rounded-[4px] shadow-xl py-2 px-2 z-50 border border-black/20">
                                <button onClick={updateCheck} className="w-full flex items-center justify-between px-2 py-1.5 text-[14px] text-[#dbdee1] rounded-[2px] hover:bg-[#4752c4] hover:text-white transition-colors mb-1" style={fontStyle}>
                                    Vérifier les mises à jour
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                                </button>
                                <div className="h-[1px] bg-[#ffffff]/[0.06] my-1" />
                                <button onClick={onLogout} className="w-full flex items-center justify-between px-2 py-1.5 text-[14px] text-[#fa777c] rounded-[2px] hover:bg-[#fa777c] hover:text-white transition-colors" style={fontStyle}>
                                    Se déconnecter
                                    <LogOut size={16} />
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
