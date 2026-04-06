// src/components/auth/LoginView.tsx
import { useState } from 'react';
import { Lock, UserPlus } from 'lucide-react';
import LoginViewProps from '../../models/loginViewProps.model';
import logoAuth from '../../assets/logo_auth.png';

/**
 * Login screen with two modes: create a new identity or recover via pseudo + password.
 */
export const LoginView = ({ onLogin, onRecover }: LoginViewProps) => {
    const [mode, setMode] = useState<'create' | 'recover'>('create');
    const [pseudo, setPseudo] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pseudo.trim().length < 2) return;
        if (password.length < 4) { setError('Mot de passe : 4 caractères minimum.'); return; }
        if (password !== confirmPassword) { setError('Les mots de passe ne correspondent pas.'); return; }
        try {
            setError(null);
            await onLogin(pseudo.trim(), password);
        } catch (err: any) {
            setError(err?.toString() ?? 'Erreur lors de la création.');
        }
    };

    const handleRecover = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pseudo.trim() || !password) return;
        try {
            setError(null);
            await onRecover(pseudo.trim(), password);
        } catch (err: any) {
            setError(err?.toString() ?? 'Pseudo ou mot de passe incorrect.');
        }
    };

    const resetFields = () => {
        setPassword('');
        setConfirmPassword('');
        setError(null);
    };

    const inputClass = "w-full glass px-4 py-3 rounded-lg border border-cyan-500/30 text-cyan-50 placeholder-cyan-500/30 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(34,211,238,0.1)] transition-all font-medium";
    const labelClass = "block text-[11px] font-black uppercase text-cyan-500/60 mb-2 tracking-widest";
    const submitClass = "w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-all cursor-pointer shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] uppercase tracking-wider text-[13px]";

    return (
        <div className="flex-1 w-full flex items-center justify-center p-4 relative overflow-hidden">
            <div className="w-full max-w-[460px] glass-modal rounded-2xl shadow-[0_8px_60px_rgba(0,0,0,0.6),0_0_40px_rgba(34,211,238,0.05)] p-10 flex flex-col items-center relative z-10">
                <img src={logoAuth} alt="Vocal WASM" className="h-16 mb-1 object-contain" />
                <p className="text-cyan-500/50 text-center mb-8 text-[13px] font-medium">
                    Identité anonyme chiffrée Ed25519
                </p>

                {/* Mode toggle */}
                <div className="flex w-full gap-2 mb-6 glass p-1.5 rounded-lg">
                    <button
                        onClick={() => { setMode('create'); resetFields(); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-[13px] font-bold rounded-md transition-all duration-300 ${
                            mode === 'create'
                                ? 'bg-cyan-500/20 text-cyan-50 shadow-[0_0_15px_rgba(34,211,238,0.15)] outline outline-1 outline-cyan-500/30'
                                : 'text-cyan-500/50 hover:text-cyan-300 hover:bg-cyan-500/5'
                        }`}
                    >
                        <UserPlus size={16} /> Créer
                    </button>
                    <button
                        onClick={() => { setMode('recover'); resetFields(); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-[13px] font-bold rounded-md transition-all duration-300 ${
                            mode === 'recover'
                                ? 'bg-cyan-500/20 text-cyan-50 shadow-[0_0_15px_rgba(34,211,238,0.15)] outline outline-1 outline-cyan-500/30'
                                : 'text-cyan-500/50 hover:text-cyan-300 hover:bg-cyan-500/5'
                        }`}
                    >
                        <Lock size={16} /> Connexion
                    </button>
                </div>

                {mode === 'create' ? (
                    <form onSubmit={handleCreate} className="w-full space-y-4">
                        <div>
                            <label className={labelClass}>Pseudo</label>
                            <input autoFocus type="text" value={pseudo} onChange={(e) => setPseudo(e.target.value)}
                                className={inputClass} placeholder="Ton pseudo…" />
                        </div>
                        <div>
                            <label className={labelClass}>Mot de passe</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                className={inputClass} placeholder="••••••••" />
                        </div>
                        <div>
                            <label className={labelClass}>Confirmer le mot de passe</label>
                            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                className={inputClass} placeholder="••••••••" />
                        </div>
                        <button type="submit" disabled={pseudo.trim().length < 2 || password.length < 4 || password !== confirmPassword}
                            className={submitClass}>
                            Générer mon identité
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleRecover} className="w-full space-y-4">
                        <div>
                            <label className={labelClass}>Pseudo</label>
                            <input autoFocus type="text" value={pseudo} onChange={(e) => setPseudo(e.target.value)}
                                className={inputClass} placeholder="Ton pseudo…" />
                        </div>
                        <div>
                            <label className={labelClass}>Mot de passe</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                className={inputClass} placeholder="••••••••" />
                        </div>
                        <button type="submit" disabled={!pseudo.trim() || !password}
                            className={submitClass}>
                            Se connecter
                        </button>
                    </form>
                )}

                {error && (
                    <p className="mt-4 text-red-400 text-[12px] font-bold uppercase tracking-wider animate-in fade-in duration-300">
                        {error}
                    </p>
                )}

                <span className="mt-8 text-[10px] text-cyan-500/30 font-bold uppercase tracking-widest">
                    Zéro DB · Clé Ed25519 locale · Argon2id
                </span>
            </div>
        </div>
    );
};