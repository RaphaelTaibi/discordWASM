import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import StreamState from "../models/streamState.model.ts";
import StreamMetrics from "../models/streamMetrics.model.ts";
import { AnalyzerWorkerOutgoingMessage } from '../types/analyzerWorkerMessage.type';

import AnalyzerWorker from '../worker/analyzer.worker.ts?worker';


const createAnalysisCanvas = (): OffscreenCanvas | HTMLCanvasElement => {
    if (typeof OffscreenCanvas !== 'undefined') {
        return new OffscreenCanvas(160, 90);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    return canvas;
};

const StreamContext = createContext<StreamState | undefined>(undefined);

export const StreamProvider = ({ children }: { children: ReactNode }) => {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isWasmReady, setIsWasmReady] = useState(false);
    const [metrics, setMetrics] = useState<StreamMetrics>({ lum: 0, status: 'IDLE' });

    const workerRef = useRef<Worker | null>(null);
    const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));
    const offscreenRef = useRef<OffscreenCanvas | HTMLCanvasElement>(createAnalysisCanvas());
    const isProcessingRef = useRef(false);
    const isWorkerBusyRef = useRef(false);
    const rafIdRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        // Initialisation de la classe Worker générée par Vite
        const worker = new AnalyzerWorker();
        workerRef.current = worker;

        worker.onmessage = (e: MessageEvent<AnalyzerWorkerOutgoingMessage>) => {
            if (e.data.type === 'READY') {
                console.log("✅ WASM Worker Ready");
                setIsWasmReady(true);
            }

            if (e.data.type === 'RESULT') {
                isWorkerBusyRef.current = false;
                const { lum, status } = e.data.payload;
                setMetrics({ lum, status });
            }

            if (e.data.type === 'ERROR') {
                isWorkerBusyRef.current = false;
                setMetrics((prev) => ({ ...prev, status: 'ERROR' }));
                console.error('Worker error:', e.data.error);
            }
        };

        worker.onerror = (error) => {
            isWorkerBusyRef.current = false;
            setMetrics((prev) => ({ ...prev, status: 'ERROR' }));
            console.error('Unhandled worker error:', error.message);
        };

        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
            worker.terminate();
            isProcessingRef.current = false;
            isWorkerBusyRef.current = false;
        };
    }, []);

    const processFrame = () => {
        if (!isProcessingRef.current || !videoRef.current || videoRef.current.paused) return;

        if (!isWasmReady || isWorkerBusyRef.current) {
            rafIdRef.current = requestAnimationFrame(processFrame);
            return;
        }

        const canvas = offscreenRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (ctx && videoRef.current.videoWidth > 0) {
            ctx.drawImage(videoRef.current, 0, 0, 160, 90);
            const imageData = ctx.getImageData(0, 0, 160, 90).data.buffer;

            isWorkerBusyRef.current = true;
            workerRef.current?.postMessage({
                type: 'ANALYZE',
                imageData,
                width: 160,
                height: 90
            }, [imageData]);
        }

        rafIdRef.current = requestAnimationFrame(processFrame);
    };

    const startCapture = async () => {
        try {
            if (isStreaming) return;

            const media = await navigator.mediaDevices.getDisplayMedia({
                video: { width: 1280, height: 720, frameRate: { ideal: 60, max: 60 } },
                audio: false
            });

            const video = videoRef.current;
            video.srcObject = media;

            await new Promise<void>((resolve) => {
                video.onloadedmetadata = () => resolve();
            });

            await video.play();

            streamRef.current = media;
            setStream(media);
            setIsStreaming(true);
            setMetrics({ lum: 0, status: isWasmReady ? 'RUNNING' : 'WAITING_WASM' });
            isProcessingRef.current = true;
            processFrame();

            media.getVideoTracks()[0].onended = () => stopCapture();
        } catch (err) {
            console.error("Capture failed:", err);
            stopCapture();
        }
    };

    const stopCapture = () => {
        isProcessingRef.current = false;

        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }

        isWorkerBusyRef.current = false;

        const currentStream = streamRef.current;
        if (currentStream) {
            currentStream.getTracks().forEach((t) => t.stop());
        }

        streamRef.current = null;
        videoRef.current.srcObject = null;
        setStream(null);
        setIsStreaming(false);
        setMetrics({ lum: 0, status: 'IDLE' });
    };

    return (
        <StreamContext.Provider value={{
            stream, isStreaming, isWasmReady, metrics, startCapture, stopCapture
        }}>
            {children}
        </StreamContext.Provider>
    );
};

export const useStreamStore = () => {
    const context = useContext(StreamContext);
    if (!context) throw new Error("useStreamStore must be used within StreamProvider");
    return context;
};