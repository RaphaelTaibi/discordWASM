import { Monitor, Video, Eye, EyeOff, Activity } from "lucide-react";
import { useState } from "react";
import GameInfo from '../../models/gameInfo.model';

export const ActivitySettings = () => {
    // Mock data for now, later we'll fetch this from a store or Tauri backend
    const [currentGame] = useState<GameInfo | null>(null);
    const [addedGames, setAddedGames] = useState<GameInfo[]>([
        { id: "1", name: "World of Warcraft", lastPlayed: "il y a 3 jours", verified: true, overlayEnabled: true },
        { id: "2", name: "League of Legends", lastPlayed: "il y a 8 jours", verified: true, overlayEnabled: true },
        { id: "3", name: "Path of Exile", lastPlayed: "il y a 11 jours", verified: true, overlayEnabled: false },
    ]);

    const toggleOverlay = (id: string) => {
        setAddedGames(prev => prev.map(game => 
            game.id === id ? { ...game, overlayEnabled: !game.overlayEnabled } : game
        ));
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            <h2 className="text-cyan-50 text-[24px] font-black uppercase tracking-wider drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                Jeux & Activité
            </h2>

            <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3 border-b border-cyan-500/20 pb-2">
                    <Activity size={20} className="text-cyan-400" />
                    <h3 className="text-cyan-100 text-[16px] font-bold uppercase tracking-widest">Activité Actuelle</h3>
                </div>
                
                <div className="glass border border-cyan-500/30 rounded-xl p-5 flex items-center justify-between shadow-[0_0_20px_rgba(34,211,238,0.1)] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/10 to-transparent pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />
                    {currentGame ? (
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-12 h-12 glass-heavy border border-cyan-500/40 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                                <Monitor size={24} className="text-cyan-400" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-cyan-300 font-black tracking-wide text-[15px]">{currentGame.name}</span>
                                <span className="text-cyan-100/60 font-medium text-[12px] uppercase tracking-widest mt-1">Analyse en cours... (~12 min)</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col relative z-10">
                            <span className="text-cyan-500/50 font-black tracking-widest text-[14px] uppercase mb-1">Aucun statut détecté</span>
                            <span className="text-cyan-100/30 text-[12px] font-medium">Connectez un hook local pour afficher votre activité.</span>
                        </div>
                    )}
                </div>
                
                <div className="mt-1 px-1">
                    <span className="text-cyan-100/50 text-[12px] font-medium">
                        Système non reconnu ? {' '}
                    </span>
                    <button className="text-cyan-400 hover:text-cyan-300 hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] text-[12px] font-bold uppercase tracking-wide transition-all ml-1 underline decoration-cyan-500/50 underline-offset-4">
                        Forcer la détection
                    </button>
                </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent my-2" />

            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2 border-b border-cyan-500/20 pb-2">
                    <h3 className="text-cyan-100 text-[16px] font-bold uppercase tracking-widest">Historique d'Activité</h3>
                    <span className="text-cyan-500/60 text-[12px] font-medium max-w-xl leading-relaxed">
                        Le système conserve localement vos dernières sessions pour un accès rapide aux paramètres d'overlay. 
                    </span>
                </div>

                <div className="flex flex-col gap-3">
                    {addedGames.map(game => (
                        <div key={game.id} className="glass rounded-xl p-4 flex items-center justify-between group hover:bg-white/[0.04] transition-all border border-cyan-500/10 hover:border-cyan-500/30 shadow-[0_0_10px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_rgba(34,211,238,0.1)] relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500/30 group-hover:bg-cyan-400 transition-colors shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                            <div className="flex items-center gap-4 pl-3 relative z-10 w-full">
                                <div className="flex flex-col flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-cyan-50 font-bold tracking-wide text-[14px]">{game.name}</span>
                                        {game.verified && (
                                            <div className="w-4 h-4 bg-cyan-500/20 border border-cyan-400 rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(34,211,238,0.4)]" title="Source validée">
                                                <svg className="w-2.5 h-2.5 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-cyan-500/50 font-black uppercase tracking-widest text-[10px]">DERNIÈRE SYNCHRO : {game.lastPlayed}</span>
                                </div>
                                
                                <div className="flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <button className="w-8 h-8 flex items-center justify-center rounded bg-cyan-900/20 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors border border-transparent hover:border-cyan-500/30" title="Configurer l'écran">
                                        <Monitor size={16} />
                                    </button>
                                    <button 
                                        className={`w-8 h-8 flex items-center justify-center rounded border transition-colors ${game.overlayEnabled ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}
                                        onClick={() => toggleOverlay(game.id)}
                                        title={game.overlayEnabled ? "Désactiver l'overlay" : "Activer l'overlay"}
                                    >
                                        {game.overlayEnabled ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>
                                    <button className="w-8 h-8 flex items-center justify-center rounded bg-purple-900/20 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 transition-colors border border-transparent hover:border-purple-500/30" title="Paramètres Stream">
                                        <Video size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

