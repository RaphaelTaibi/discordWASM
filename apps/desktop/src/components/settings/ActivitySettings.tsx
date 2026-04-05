import { Monitor, Video, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface GameInfo {
    id: string;
    name: string;
    lastPlayed: string;
    verified: boolean;
    overlayEnabled: boolean;
}

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
        <div className="flex flex-col gap-8">
            <h2 className="text-[#f2f3f5] text-[20px] font-bold">Jeux enregistrés</h2>

            <div className="flex flex-col gap-2">
                <h3 className="text-[#f2f3f5] text-[16px] font-bold">Jeu actuel</h3>
                
                <div className="bg-[#2b2d31] rounded-lg p-4 flex items-center justify-between border border-transparent">
                    {currentGame ? (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#1e1f22] rounded flex items-center justify-center">
                                {/* Icon placeholder */}
                                <Monitor size={24} className="text-[#23a55a]" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[#23a55a] font-bold text-[14px]">{currentGame.name}</span>
                                <span className="text-[#b5bac1] text-[13px]">Joue depuis 12 min</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <span className="text-[#dbdee1] font-bold text-[14px]">Aucun jeu détecté</span>
                            <span className="text-[#b5bac1] text-[13px]">À quel jeu tu joues ?</span>
                        </div>
                    )}
                </div>
                
                <div className="mt-1">
                    <span className="text-[#b5bac1] text-[13px]">
                        Tu ne trouves pas ton jeu ? {' '}
                    </span>
                    <button className="text-[#00a8fc] hover:underline text-[13px] font-medium">Ajoute-le !</button>
                </div>
            </div>

            <div className="h-[1px] bg-white/10 my-2" />

            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <h3 className="text-[#f2f3f5] text-[16px] font-bold">Jeux ajoutés</h3>
                    <span className="text-[#b5bac1] text-[13px]">
                        Certaines informations sur les jeux (telles que le genre ou l'illustration de couverture) sont fournies par IGDB.
                    </span>
                </div>

                <div className="flex flex-col gap-2">
                    {addedGames.map(game => (
                        <div key={game.id} className="bg-[#2b2d31] rounded-lg p-4 flex items-center justify-between group hover:bg-[#35373c] transition-colors border border-black/10">
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[#dbdee1] font-bold text-[14px]">{game.name}</span>
                                        {game.verified && (
                                            <div className="w-4 h-4 bg-[#5865f2] rounded-full flex items-center justify-center" title="Jeu vérifié">
                                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[#b5bac1] text-[12px]">Dernière session de jeu : {game.lastPlayed}</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4 opacity-70 group-hover:opacity-100 transition-opacity">
                                <button className="text-[#b5bac1] hover:text-[#dbdee1] transition-colors" title="Désactiver l'overlay local">
                                    <Monitor size={20} />
                                </button>
                                <button 
                                    className={`${game.overlayEnabled ? 'text-[#b5bac1] hover:text-[#dbdee1]' : 'text-[#f23f42] hover:text-[#dbdee1]'} transition-colors`}
                                    onClick={() => toggleOverlay(game.id)}
                                    title={game.overlayEnabled ? "Désactiver l'overlay" : "Activer l'overlay"}
                                >
                                    {game.overlayEnabled ? <Eye size={20} /> : <EyeOff size={20} />}
                                </button>
                                <button className="text-[#b5bac1] hover:text-[#dbdee1] transition-colors" title="Paramètres de stream">
                                    <Video size={20} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


