import { useEffect, useState, useRef } from 'react';
import init, { check_quality, analyze_frame } from './pkg/core_wasm'; // On importe la nouvelle fonction
import './App.css';

function App() {
    const [msg, setMsg] = useState("Chargement de Rust...");
    const [analysis, setAnalysis] = useState("En attente de flux...");
    const [isStreaming, setIsStreaming] = useState(false);
    const [isTooBright, setIsTooBright] = useState(false); // Pour le test "Rouge"

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        init().then(() => {
            setMsg(check_quality(8500));
        });
    }, []);

    // BOUCLE D'ANALYSE RUST (60 FPS)
    useEffect(() => {
        let animationId: number;

        const loop = () => {
            if (isStreaming && videoRef.current && canvasRef.current) {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                if (ctx && video.readyState >= 2) {
                    // On réduit la résolution pour que Rust traite ça instantanément
                    canvas.width = 160;
                    canvas.height = 90;

                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                    // APPEL À RUST
                    const rustResult = analyze_frame(
                        new Uint8Array(imageData.data.buffer),
                        canvas.width,
                        canvas.height
                    );

                    setAnalysis(rustResult);

                    // LOGIQUE "ROUGE" : Si la luminosité (extraite du string Rust) est > 200
                    const lum = parseInt(rustResult.split(': ').pop() || "0");
                    setIsTooBright(lum > 200);
                }
            }
            animationId = requestAnimationFrame(loop);
        };

        if (isStreaming) {
            animationId = requestAnimationFrame(loop);
        }
        return () => cancelAnimationFrame(animationId);
    }, [isStreaming]);

    const startStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { width: 1920, height: 1080, frameRate: 60 },
                audio: false
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsStreaming(true);
            }
        } catch (err) { console.error(err); }
    };

    const killStream = () => {
        if (videoRef.current?.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
            setIsStreaming(false);
            setIsTooBright(false);
            setAnalysis("Stream Off")
        }
    };

    return (
        <div className={`h-screen transition-colors duration-300 flex flex-col items-center p-8 ${isTooBright ? 'bg-red-900' : 'bg-[#1e1f22]'}`}>
            <h1 className="text-3xl font-bold mb-6 text-[#5865f2]">Discord WASM Bridge</h1>

            <div className="w-full max-w-4xl flex flex-col gap-6">
                <div className={`relative aspect-video bg-black rounded-2xl overflow-hidden border-2 shadow-2xl transition-colors ${isTooBright ? 'border-red-500' : 'border-[#2b2d31]'}`}>
                    {!isStreaming && <div className="absolute inset-0 flex items-center justify-center text-gray-500">Prêt pour le stream</div>}
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />

                    {/* Overlay Alerte Rust */}
                    {isTooBright && (
                        <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                            ALERTE LUMINOSITÉ (RUST)
                        </div>
                    )}
                </div>

                <div className="bg-[#2b2d31] p-4 rounded-xl border border-white/5 flex items-center justify-between">
                    <div className="flex gap-8">
                        <div>
                            <p className="text-xs font-bold uppercase text-gray-400">Engine</p>
                            <p className="text-sm font-mono text-[#5865f2]">{msg}</p>
                        </div>
                        <div className="border-l border-white/10 pl-8">
                            <p className="text-xs font-bold uppercase text-gray-400">Analyse Live (WASM)</p>
                            <p className={`text-sm font-mono ${isTooBright ? 'text-red-400' : 'text-green-400'}`}>
                                {isStreaming ? analysis : "---"}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={isStreaming ? killStream : startStream} className={`px-6 py-3 rounded-md font-bold transition-all ${isStreaming ? 'bg-red-500 hover:bg-red-600' : 'bg-[#5865f2] hover:bg-[#4752c4]'}`}>
                            {isStreaming ? "Arrêter" : "Démarrer le stream"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Canvas caché pour le traitement */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}

export default App;