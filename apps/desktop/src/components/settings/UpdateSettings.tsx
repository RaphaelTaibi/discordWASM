import { CheckCircle, Download, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { UpdateSettingsProps } from "../../models/updateSettingsProps.model";

export const UpdateSettings = ({ updateAvailable, updateStatus, triggerUpdate, checkForUpdate }: UpdateSettingsProps) => {
    const [appVersion, setAppVersion] = useState<string>('');

    useEffect(() => {
        getVersion().then(v => setAppVersion(v)).catch(() => setAppVersion('0.0.0'));
    }, []);

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            <h2 className="text-cyan-50 text-[24px] font-black uppercase tracking-wider drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                Mises à jour
            </h2>
                                
            <div className="bg-[#050511] border border-cyan-500/20 p-6 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.05)] relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/10 to-transparent pointer-events-none rounded-xl" />
                
                <h3 className="text-cyan-500/70 text-[11px] font-black uppercase tracking-widest mb-5">Version du Système</h3>
                
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex flex-col gap-1">
                        <span className="text-cyan-100/60 font-bold text-[13px]">Version actuelle</span>
                        <span className="text-cyan-50 font-black text-[18px] tracking-wide">v{appVersion}</span>
                    </div>
                    <button 
                        onClick={checkForUpdate}
                        disabled={updateStatus === 'Vérification...' || updateStatus === 'Installation de la mise à jour...'}
                        className="bg-cyan-500/10 hover:bg-cyan-500/20 disabled:bg-cyan-500/5 disabled:cursor-not-allowed text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 disabled:border-cyan-500/10 disabled:text-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.1)] hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] text-[13px] font-bold px-5 py-2.5 rounded-lg transition-all flex items-center gap-2"
                    >
                        <RefreshCw size={16} className={(updateStatus === 'Vérification...' || updateStatus === 'Installation de la mise à jour...') ? 'animate-spin' : ''} />
                        Vérifier
                    </button>
                </div>

                {updateStatus && (
                    <div className={`flex items-center gap-2 mt-5 pt-5 border-t border-cyan-500/10 text-[13px] font-bold ${updateStatus.includes('Erreur') ? 'text-red-400' : 'text-cyan-100/60'}`}>
                        {updateStatus.includes('Erreur') ? <X size={18} className="text-red-400" /> : <CheckCircle size={18} className="text-emerald-400" />}
                        <span>{updateStatus}</span>
                    </div>
                )}

                {!updateAvailable && !updateStatus && (
                    <div className="flex items-center gap-2 mt-5 pt-5 border-t border-cyan-500/10 text-emerald-400">
                        <CheckCircle size={18} />
                        <span className="text-[13px] font-bold">Le système est à jour.</span>
                    </div>
                )}
            </div>

            {updateAvailable && (
                <div className="bg-[#050511] border border-emerald-500/30 p-6 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.1)] relative group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-900/20 to-transparent pointer-events-none rounded-xl" />
                    
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex flex-col gap-1">
                            <span className="text-emerald-400 font-black text-[14px] uppercase tracking-wider">Mise à jour disponible</span>
                            <span className="text-cyan-100/50 text-[12px] font-medium">Prête à être téléchargée et installée.</span>
                        </div>
                        <button 
                            onClick={triggerUpdate}
                            disabled={updateStatus === 'Installation de la mise à jour...'}
                            className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:from-emerald-600/50 disabled:to-cyan-600/50 text-white text-[13px] font-bold px-6 py-2.5 rounded-lg transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                        >
                            <Download size={16} /> Installer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
