import { Copy, LogOut, Trash2, Upload, User, Hash } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { useVoiceStore } from "../../context/VoiceContext";
import { useAuth } from "../../context/AuthContext";

export const ProfileSettings = () => {
    const { voiceAvatar, setVoiceAvatar } = useVoiceStore();
    const { username, publicKey, userTag, logout, updateUsername } = useAuth();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [nameInputValue, setNameInputValue] = useState(username || '');
    const [isSaving, setIsSaving] = useState(false);
    const [keyCopied, setKeyCopied] = useState(false);
    const [tagCopied, setTagCopied] = useState(false);

    useEffect(() => {
        setNameInputValue(username || '');
    }, [username]);

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            setVoiceAvatar(event.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleSaveName = () => {
        const newName = nameInputValue.trim();
        if (newName && newName !== username) {
            setIsSaving(true);
            updateUsername(newName);
            setTimeout(() => {
                setIsSaving(false);
            }, 300);
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            <h2 className="text-cyan-50 text-[24px] font-black uppercase tracking-wider drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">Mon Profil</h2>

            <div className="flex flex-col gap-8">
                {/* Section Avatar */}
                <div className="glass border border-cyan-500/20 p-6 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.05)] relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/10 to-transparent pointer-events-none rounded-xl" />
                    
                    <h3 className="text-cyan-500/70 text-[11px] font-black uppercase tracking-widest mb-4">Avatar du Système</h3>
                    
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="w-24 h-24 rounded-full glass-heavy overflow-hidden flex items-center justify-center flex-shrink-0 border-2 border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.2)] group-hover:border-cyan-400 group-hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all duration-300">
                            {voiceAvatar ? <img src={voiceAvatar} alt="Avatar" className="w-full h-full object-cover" /> : <User size={40} className="text-cyan-500/30" />}
                        </div>
                        <div className="flex flex-col gap-3">
                            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleAvatarUpload} />
                            <button 
                                className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.1)] hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] text-[13px] font-bold px-4 py-2.5 rounded-lg transition-all flex items-center gap-2"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload size={16} /> Transférer l'Avatar
                            </button>
                            {voiceAvatar && (
                                <button 
                                    className="text-red-400 hover:text-red-300 hover:shadow-[0_0_10px_rgba(248,113,113,0.3)] text-[12px] flex items-center gap-1.5 font-bold uppercase tracking-wider self-start px-2 py-1 rounded transition-colors"
                                    onClick={() => setVoiceAvatar(null)}
                                >
                                    <Trash2 size={14} /> Réinitialiser
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Section Pseudo */}
                <div className="glass border border-cyan-500/20 p-6 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.05)] relative group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/10 to-transparent pointer-events-none rounded-xl" />
                    
                    <h3 className="text-cyan-500/70 text-[11px] font-black uppercase tracking-widest mb-4">Identification Réseau</h3>
                    
                    <div className="flex flex-col gap-4 relative z-10">
                        <div className="flex flex-col gap-2">
                            <label className="text-cyan-100/60 font-bold text-[13px]">Identifiant (Nom d'utilisateur)</label>
                            <div className="relative flex items-center glass rounded-lg border border-cyan-500/30 focus-within:border-cyan-400 focus-within:shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-all">
                                <span className="pl-4 text-cyan-500/50 font-bold tracking-widest uppercase">Name:</span>
                                <input 
                                    type="text" 
                                    value={nameInputValue} 
                                    onChange={(e) => setNameInputValue(e.target.value)} 
                                    className="w-full bg-transparent border-none px-3 py-3 text-cyan-50 font-medium focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end mt-2">
                            <button 
                                className={`px-6 py-2.5 rounded-lg text-white font-bold text-[13px] transition-all flex items-center justify-center min-w-[140px] uppercase tracking-wider ${
                                    isSaving 
                                    ? 'bg-cyan-900/50 border border-cyan-700/50 cursor-wait' 
                                    : nameInputValue.trim() && nameInputValue !== username 
                                        ? 'bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 shadow-[0_0_15px_rgba(34,211,238,0.3)]' 
                                        : 'glass border border-cyan-500/20 text-cyan-500/30 cursor-not-allowed'
                                }`}
                                onClick={handleSaveName}
                                disabled={!nameInputValue.trim() || nameInputValue === username || isSaving}
                            >
                                {isSaving ? <span className="animate-pulse">Modification...</span> : 'Sauvegarder'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Section User Tag */}
                <div className="glass border border-purple-500/20 p-6 rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.05)] relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 to-cyan-900/5 pointer-events-none rounded-xl" />

                    <h3 className="text-purple-400/70 text-[11px] font-black uppercase tracking-widest mb-4">Tag Utilisateur</h3>

                    <div className="flex items-center gap-3 relative z-10">
                        <div className="flex-1 glass-heavy px-4 py-3 rounded-lg border border-purple-500/20 flex items-center gap-2">
                            <Hash size={16} className="text-purple-400/50 flex-shrink-0" />
                            <span className="text-cyan-50 text-[18px] font-black tracking-wide">
                                {userTag
                                    ? <>{username}<span className="text-purple-400">#{userTag.split('#')[1]}</span></>
                                    : <span className="text-cyan-500/30 text-[14px]">Chargement…</span>
                                }
                            </span>
                        </div>
                        <button
                            className="p-2.5 glass rounded-lg border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] transition-all flex-shrink-0 disabled:opacity-30"
                            onClick={() => {
                                if (!userTag) return;
                                navigator.clipboard.writeText(userTag);
                                setTagCopied(true);
                                setTimeout(() => setTagCopied(false), 2000);
                            }}
                            disabled={!userTag}
                            title="Copier le tag"
                        >
                            <Copy size={16} />
                        </button>
                    </div>
                    {tagCopied && (
                        <p className="text-purple-400 text-[11px] mt-2 font-bold uppercase tracking-wider animate-in fade-in duration-200">
                            Copié !
                        </p>
                    )}
                    <p className="text-purple-400/30 text-[10px] mt-3 font-medium">
                        Partagez ce tag avec vos amis pour qu'ils puissent vous ajouter.
                    </p>
                </div>

                {/* Section Public Key */}
                {publicKey && (
                    <div className="glass border border-cyan-500/20 p-6 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.05)] relative group">
                        <div className="absolute inset-0 bg-gradient-to-bl from-cyan-900/10 to-transparent pointer-events-none rounded-xl" />

                        <h3 className="text-cyan-500/70 text-[11px] font-black uppercase tracking-widest mb-4">Clé Publique Ed25519</h3>

                        <div className="flex items-center gap-3 relative z-10">
                            <code className="flex-1 glass-heavy px-4 py-3 rounded-lg text-cyan-300/80 text-[11px] font-mono break-all border border-cyan-500/20 select-all">
                                {publicKey}
                            </code>
                            <button
                                className="p-2.5 glass rounded-lg border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all flex-shrink-0"
                                onClick={() => {
                                    navigator.clipboard.writeText(publicKey);
                                    setKeyCopied(true);
                                    setTimeout(() => setKeyCopied(false), 2000);
                                }}
                                title="Copier la clé publique"
                            >
                                <Copy size={16} />
                            </button>
                        </div>
                        {keyCopied && (
                            <p className="text-cyan-400 text-[11px] mt-2 font-bold uppercase tracking-wider animate-in fade-in duration-200">
                                Copié !
                            </p>
                        )}
                        <p className="text-cyan-500/30 text-[10px] mt-3 font-medium">
                            Partagez cette clé pour que vos contacts puissent vous retrouver.
                        </p>
                    </div>
                )}

                {/* Section Déconnexion */}
                <div className="glass border border-red-500/20 p-6 rounded-xl shadow-[0_0_20px_rgba(248,113,113,0.05)] relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-900/10 to-transparent pointer-events-none rounded-xl" />

                    <h3 className="text-red-500/70 text-[11px] font-black uppercase tracking-widest mb-4">Zone Dangereuse</h3>

                    <button
                        onClick={logout}
                        className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-400 shadow-[0_0_10px_rgba(248,113,113,0.1)] hover:shadow-[0_0_20px_rgba(248,113,113,0.3)] text-[13px] font-bold px-5 py-2.5 rounded-lg transition-all uppercase tracking-wider relative z-10"
                    >
                        <LogOut size={16} /> Se déconnecter
                    </button>
                </div>
            </div>
        </div>
    );
};
