import { useEffect, useRef, useState } from "react";
import { useVoiceStore } from "../../context/VoiceContext";

export const VoiceVideoSettings = () => {
    const { 
        smartGateEnabled, setSmartGateEnabled,
        selectedMic, setSelectedMic,
        selectedSpeaker, setSelectedSpeaker,
        vadAuto, setVadAuto,
        vadThreshold, setVadThreshold,
        rawMicVolumeRef,
        webrtcNoiseSuppressionEnabled, setWebrtcNoiseSuppressionEnabled
    } = useVoiceStore() as any;

    const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
    const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
    const [micVolume, setMicVolume] = useState(0);
    const animationRef = useRef<number | null>(null);

    useEffect(() => {
        navigator.mediaDevices.enumerateDevices().then(devices => {
            setMicrophones(devices.filter(d => d.kind === 'audioinput'));
            setSpeakers(devices.filter(d => d.kind === 'audiooutput'));
        });
    }, []);

    useEffect(() => {
        let shouldContinue = true;
        const updateAudioLevel = () => {
            const rms = rawMicVolumeRef?.current ?? 0;
            const db = rms > 0 ? 20 * Math.log10(rms) : -100;
            const volPercent = db + 100;
            setMicVolume(Math.max(0, Math.min(100, volPercent)));
            if (shouldContinue) {
                animationRef.current = requestAnimationFrame(updateAudioLevel);
            }
        };
        animationRef.current = requestAnimationFrame(updateAudioLevel);
        return () => {
            shouldContinue = false;
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [rawMicVolumeRef]);

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            <h2 className="text-cyan-50 text-[24px] font-black uppercase tracking-wider drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                Paramètres Audio
            </h2>

            {/* Section Périphériques */}
            <div className="bg-[#050511] border border-cyan-500/20 p-6 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.05)] relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/10 to-transparent pointer-events-none rounded-xl" />
                
                <h3 className="text-cyan-500/70 text-[11px] font-black uppercase tracking-widest mb-5">Périphériques Audio</h3>
                
                <div className="flex flex-col gap-5 relative z-10">
                    {/* Périphérique d'entrée */}
                    <div className="flex flex-col gap-2">
                        <label className="text-cyan-100/60 font-bold text-[13px]">Périphérique d'entrée</label>
                        <select 
                            value={selectedMic || ''}
                            onChange={(e) => setSelectedMic(e.target.value)}
                            className="w-full bg-[#0a0b14] text-cyan-50 px-4 py-3 rounded-lg border border-cyan-500/30 focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(34,211,238,0.2)] focus:outline-none transition-all font-medium"
                        >
                            <option value="">Défaut</option>
                            {microphones.map(mic => (
                                <option key={mic.deviceId} value={mic.deviceId}>
                                    {mic.label || `Microphone ${mic.deviceId.slice(0,5)}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Périphérique de sortie */}
                    <div className="flex flex-col gap-2">
                        <label className="text-cyan-100/60 font-bold text-[13px]">Périphérique de sortie</label>
                        <select 
                            value={selectedSpeaker || ''}
                            onChange={(e) => setSelectedSpeaker(e.target.value)}
                            className="w-full bg-[#0a0b14] text-cyan-50 px-4 py-3 rounded-lg border border-cyan-500/30 focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(34,211,238,0.2)] focus:outline-none transition-all font-medium"
                        >
                            <option value="">Défaut</option>
                            {speakers.map(spk => (
                                <option key={spk.deviceId} value={spk.deviceId}>
                                    {spk.label || `Haut-parleur ${spk.deviceId.slice(0,5)}`}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Section Sensibilité Micro */}
            <div className="bg-[#050511] border border-cyan-500/20 p-6 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.05)] relative group">
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/10 to-transparent pointer-events-none rounded-xl" />
                
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-cyan-500/70 text-[11px] font-black uppercase tracking-widest">Sensibilité du Microphone</h3>
                    <div className="flex items-center gap-3">
                        <span className="text-cyan-100/40 text-[12px] font-bold uppercase tracking-wider">Auto</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={vadAuto ?? true} 
                                onChange={(e) => setVadAuto?.(e.target.checked)} 
                            />
                            <div className="w-11 h-6 bg-[#0a0b14] border border-cyan-500/30 rounded-full peer peer-checked:bg-cyan-500 peer-checked:border-cyan-400 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"></div>
                        </label>
                    </div>
                </div>

                <div className={`flex flex-col gap-3 relative z-10 transition-all duration-300 ${vadAuto ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                    {/* Barre de captation voix + slider */}
                    <div className="relative w-full h-6 flex items-center">
                        <div className="absolute left-0 w-full h-3 rounded-full overflow-hidden bg-[#0a0b14] border border-cyan-500/20 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
                            {/* Zone avant/après seuil */}
                            <div 
                                className="absolute inset-0" 
                                style={{ background: `linear-gradient(to right, rgba(139,92,246,0.2) ${(vadThreshold ?? 0.3) * 100}%, rgba(34,211,238,0.2) ${(vadThreshold ?? 0.3) * 100}%)` }} 
                            />
                            {/* Barre de volume en temps réel */}
                            <div 
                                className="absolute inset-0 transition-all duration-75"
                                style={{ 
                                    background: `linear-gradient(to right, #8b5cf6 ${(vadThreshold ?? 0.3) * 100}%, #22d3ee ${(vadThreshold ?? 0.3) * 100}%)`,
                                    clipPath: `inset(0 ${100 - micVolume}% 0 0)`
                                }}
                            />
                        </div>
                        <input 
                            type="range" 
                            className="w-full absolute opacity-0 z-20 cursor-pointer h-full"
                            min="0" max="1" step="0.01"
                            value={vadThreshold ?? 0.3}
                            onChange={(e) => setVadThreshold?.(parseFloat(e.target.value))}
                            disabled={vadAuto}
                        />
                        {/* Curseur du seuil */}
                        <div 
                            className="absolute h-5 w-1.5 bg-white rounded-sm shadow-[0_0_8px_rgba(255,255,255,0.9)] z-10 pointer-events-none"
                            style={{ left: `calc(${(vadThreshold ?? 0.3) * 100}% - 3px)` }}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-cyan-500/40 font-black uppercase tracking-widest">
                        <span>Sensible</span>
                        <span>Fort</span>
                    </div>
                </div>
            </div>

            {/* Section Traitement Artificiel WASM */}
            <div className="bg-[#050511] border border-cyan-500/20 p-6 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.05)] relative group">
                <div className="absolute inset-0 bg-gradient-to-bl from-cyan-900/10 to-transparent pointer-events-none rounded-xl" />
                
                <div className="flex items-center gap-3 mb-5">
                    <h3 className="text-cyan-500/70 text-[11px] font-black uppercase tracking-widest">Traitement Artificiel</h3>
                    <span className="bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-[0_0_10px_rgba(34,211,238,0.3)]">
                        WASM
                    </span>
                </div>

                <div className="flex flex-col gap-3 relative z-10">
                    {/* Noise Gate WASM */}
                    <div className="bg-[#0a0b14] rounded-lg p-4 flex items-center justify-between border border-cyan-500/10 hover:border-cyan-500/30 transition-all group/card">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500/30 group-hover/card:bg-purple-400 transition-colors rounded-l-lg" />
                        <div className="flex flex-col gap-1 pl-2">
                            <span className="text-cyan-50 font-bold text-[14px]">Noise Gate WASM (Rust)</span>
                            <span className="text-cyan-500/50 text-[12px] font-medium">
                                Réduit automatiquement les bruits de fond constants.
                            </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={smartGateEnabled ?? false} 
                                onChange={(e) => setSmartGateEnabled?.(e.target.checked)} 
                            />
                            <div className="w-11 h-6 bg-[#1a1c24] border border-cyan-500/20 rounded-full peer peer-checked:bg-cyan-500 peer-checked:border-cyan-400 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"></div>
                        </label>
                    </div>

                    {/* Réduction de bruit WebRTC */}
                    <div className="bg-[#0a0b14] rounded-lg p-4 flex items-center justify-between border border-cyan-500/10 hover:border-cyan-500/30 transition-all group/card">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500/30 group-hover/card:bg-cyan-400 transition-colors rounded-l-lg" />
                        <div className="flex flex-col gap-1 pl-2">
                            <span className="text-cyan-50 font-bold text-[14px]">Réduction de bruit WebRTC</span>
                            <span className="text-cyan-500/50 text-[12px] font-medium">
                                Utilise l'algorithme intégré de réduction de bruit du navigateur.
                            </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={webrtcNoiseSuppressionEnabled ?? true} 
                                onChange={(e) => setWebrtcNoiseSuppressionEnabled?.(e.target.checked)} 
                            />
                            <div className="w-11 h-6 bg-[#1a1c24] border border-cyan-500/20 rounded-full peer peer-checked:bg-cyan-500 peer-checked:border-cyan-400 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"></div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};
