import { Headphones, Mic, MicOff, Monitor } from 'lucide-react';
import BottomActionsProps from '../../models/bottomActionsProps.model';

export const BottomActions = ({
    metricsLum,
    metricsStatus,
    isStreaming,
    onToggleStream,
    isMuted,
    onToggleMute,
    isDeafened,
    onToggleDeafen,
    channelId,
}: BottomActionsProps) => (
    <div className="w-full flex items-center justify-between gap-4">
        <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-gray-500">Flux Rust WASM</span>
            <span className={metricsLum > 220 ? 'text-red-400 font-mono' : 'text-green-400 font-mono'}>
                {metricsStatus} (Lum: {metricsLum})
            </span>
        </div>

        <div className="flex items-center gap-2">
            <button
                onClick={onToggleMute}
                disabled={!channelId}
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                aria-pressed={isMuted}
                className="w-10 h-10 rounded-full font-semibold bg-[#3f4147] hover:bg-[#4a4d55] disabled:opacity-50 text-white cursor-pointer inline-flex items-center justify-center transition-all duration-150 active:scale-90"
            >
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            <button
                onClick={onToggleDeafen}
                disabled={!channelId}
                title={isDeafened ? 'Activer le son entrant' : 'Couper le son entrant'}
                aria-label={isDeafened ? 'Activer le son entrant' : 'Couper le son entrant'}
                aria-pressed={isDeafened}
                className="w-10 h-10 rounded-full font-semibold bg-[#3f4147] hover:bg-[#4a4d55] disabled:opacity-50 text-white cursor-pointer inline-flex items-center justify-center transition-all duration-150 active:scale-90"
            >
                <Headphones size={16} className={isDeafened ? 'text-red-300' : 'text-gray-100'} />
            </button>

            <button
                onClick={onToggleStream}
                className={`px-6 py-2 rounded-full font-bold transition-all duration-200 inline-flex items-center gap-2 active:scale-95 ${
                    isStreaming ? 'bg-red-500 hover:bg-red-600' : 'bg-[#248046] hover:bg-[#1a6334]'
                } text-white cursor-pointer`}
            >
                <Monitor size={16} />
                {isStreaming ? 'Arrêter le partage' : "Partager l'écran"}
            </button>
        </div>
    </div>
);


