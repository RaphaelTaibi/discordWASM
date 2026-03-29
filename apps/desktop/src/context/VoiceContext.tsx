import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ClientSignalMessage } from '../types/clientSignal.type';
import { ServerSignalMessage } from '../types/serverSignal.type';
import VoicePeer from '../models/voicePeer.model';
import VoiceState from '../models/voiceState.model';
import { useToast } from './ToastContext';
import initWasm, { calculate_network_quality } from '../pkg/core_wasm';

// On s'assure que l'URL est bien récupérée, avec un log pour débugger dans le build
const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL

const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

export interface ChatMessage {
    id: string;
    from: string;
    username: string;
    message: string;
    timestamp: number;
}

export interface ExtendedVoiceState extends VoiceState {
    networkQuality: 0 | 1 | 2 | 3;
    ping: number;
    chatMessages: ChatMessage[];
    sendChatMessage: (message: string) => void;
}

const VoiceContext = createContext<ExtendedVoiceState | undefined>(undefined);

export const VoiceProvider = ({ children }: { children: ReactNode }) => {
    const { addToast } = useToast();
    const [channelId, setChannelId] = useState<string | null>(null);
    const [participants, setParticipants] = useState<VoicePeer[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [userVolumes, setUserVolumes] = useState<Map<string, number>>(new Map());

    const [networkQuality, setNetworkQuality] = useState<0 | 1 | 2 | 3>(3);
    const [ping, setPing] = useState<number>(0);
    const [wasmReady, setWasmReady] = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

    const socketRef = useRef<WebSocket | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const userIdRef = useRef<string>(buildUserId());
    const usernameRef = useRef<string>('Anonymous');
    const channelIdRef = useRef<string | null>(null);

    const connectSocket = useCallback(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN) return;
        
        console.log("URL de signaling utilisée:", SIGNALING_URL);
        const socket = new WebSocket(SIGNALING_URL);
        socketRef.current = socket;

        socket.onopen = () => {
            console.log("Connecté au signaling");
            if (channelIdRef.current) {
                socket.send(JSON.stringify({ 
                    type: 'join', 
                    channelId: channelIdRef.current, 
                    userId: userIdRef.current, 
                    username: usernameRef.current 
                }));
            }
        };

        socket.onerror = (e) => {
            console.error("Erreur WebSocket détaillée:", e);
            // On affiche l'URL dans le toast pour que tu puisses vérifier sur l'exe
            addToast(`Erreur connexion: ${SIGNALING_URL}`, 'error');
        };

        socket.onclose = (event) => {
            console.warn(`WebSocket fermé (code: ${event.code}), reconnexion dans 3s...`);
            setIsConnected(false);
            setTimeout(connectSocket, 3000);
        };
        
        socket.onmessage = async (event) => {
            try {
                const msg = JSON.parse(event.data) as ServerSignalMessage;
                switch (msg.type) {
                    case 'joined':
                        setIsConnected(true);
                        setParticipants([{ userId: userIdRef.current, username: usernameRef.current, isMuted: false, isDeafened: false }, ...msg.peers]);
                        msg.peers.forEach(p => createPeerConnection(p));
                        break;
                    case 'peer-joined':
                        setParticipants(p => p.some(part => part.userId === msg.peer.userId) ? p : [...p, msg.peer]);
                        createPeerConnection(msg.peer);
                        addToast(`${msg.peer.username} a rejoint`, 'join');
                        break;
                    case 'peer-left':
                        const pc = peerConnectionsRef.current.get(msg.userId);
                        if (pc) { pc.close(); peerConnectionsRef.current.delete(msg.userId); }
                        setParticipants(p => p.filter(part => part.userId !== msg.userId));
                        setRemoteStreams(p => { const n = new Map(p); n.delete(msg.userId); return n; });
                        break;
                    case 'peer-state':
                        setParticipants(p => p.map(part => part.userId === msg.userId ? { ...part, isMuted: msg.isMuted, isDeafened: msg.isDeafened } : part));
                        break;
                    case 'offer':
                        const pcOffer = createPeerConnection({ userId: msg.from, username: msg.fromUsername });
                        await pcOffer.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                        const answer = await pcOffer.createAnswer();
                        await pcOffer.setLocalDescription(answer);
                        sendSignal({ type: 'answer', channelId: msg.channelId, from: userIdRef.current, to: msg.from, sdp: answer });
                        break;
                    case 'answer':
                        const pcAnswer = peerConnectionsRef.current.get(msg.from);
                        if (pcAnswer && pcAnswer.signalingState === 'have-local-offer') await pcAnswer.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                        break;
                    case 'ice':
                        const pcIce = peerConnectionsRef.current.get(msg.from);
                        if (pcIce && msg.candidate) await pcIce.addIceCandidate(new RTCIceCandidate(msg.candidate));
                        break;
                    case 'chat':
                        setChatMessages(prev => [...prev, { id: `${msg.from}-${msg.timestamp}`, from: msg.from, username: msg.username, message: msg.message, timestamp: Number(msg.timestamp) }]);
                        break;
                }
            } catch (e) { console.error("Message error", e); }
        };
    }, [addToast]);

    useEffect(() => {
        initWasm().then(() => setWasmReady(true)).catch(e => { console.error("WASM stats error", e); setWasmReady(true); });
        connectSocket();
        return () => { socketRef.current?.close(); };
    }, [connectSocket]);

    useEffect(() => {
        if (!isConnected || !wasmReady) return;
        const interval = setInterval(async () => {
            try {
                let totalRTT = 0, count = 0, totalLoss = 0, totalJitter = 0;
                for (const pc of peerConnectionsRef.current.values()) {
                    if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') continue;
                    const stats = await pc.getStats();
                    stats.forEach(r => {
                        if (r.type === 'remote-inbound-rtp' && r.roundTripTime !== undefined) { totalRTT += r.roundTripTime * 1000; count++; }
                        if (r.type === 'inbound-rtp' && r.kind === 'audio') {
                            if (r.packetsLost !== undefined && r.packetsReceived !== undefined) totalLoss += r.packetsLost / (r.packetsLost + r.packetsReceived || 1);
                            if (r.jitter !== undefined) totalJitter += r.jitter * 1000;
                        }
                    });
                }
                if (count > 0 && typeof calculate_network_quality === 'function') {
                    const avgRTT = totalRTT / count;
                    setPing(Math.max(1, Math.round(avgRTT)));
                    setNetworkQuality(calculate_network_quality(avgRTT, totalLoss / count, totalJitter / count) as 0 | 1 | 2 | 3);
                }
            } catch (e) { console.warn("Stats error", e); }
        }, 2000);
        return () => clearInterval(interval);
    }, [isConnected, wasmReady]);

    const sendSignal = useCallback((payload: ClientSignalMessage) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify(payload));
        }
    }, []);

    const createPeerConnection = useCallback((peer: VoicePeer) => {
        let pc = peerConnectionsRef.current.get(peer.userId);
        if (!pc) {
            pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            const local = localStreamRef.current;
            if (local) local.getAudioTracks().forEach(t => pc!.addTrack(t, local));
            pc.onicecandidate = (e) => { if (e.candidate && channelIdRef.current) sendSignal({ type: 'ice', channelId: channelIdRef.current, from: userIdRef.current, to: peer.userId, candidate: e.candidate.toJSON() }); };
            pc.ontrack = (e) => { if (e.streams && e.streams[0]) setRemoteStreams(prev => new Map(prev).set(peer.userId, e.streams[0])); };
            pc.onnegotiationneeded = async () => {
                if (userIdRef.current > peer.userId) return;
                try {
                    const offer = await pc!.createOffer();
                    await pc!.setLocalDescription(offer);
                    if (channelIdRef.current) sendSignal({ type: 'offer', channelId: channelIdRef.current, from: userIdRef.current, to: peer.userId, sdp: offer });
                } catch (err) { console.error("Negotiation error", err); }
            };
            peerConnectionsRef.current.set(peer.userId, pc);
        }
        return pc;
    }, [sendSignal]);

    const leaveChannel = useCallback(() => {
        if (channelIdRef.current) sendSignal({ type: 'leave', channelId: channelIdRef.current, userId: userIdRef.current });
        peerConnectionsRef.current.forEach(pc => pc.close());
        peerConnectionsRef.current.clear();
        if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
        setIsConnected(false);
        setChannelId(null);
        channelIdRef.current = null;
        setParticipants([]);
        setRemoteStreams(new Map());
    }, [sendSignal]);

    const joinChannel = useCallback(async (nextChannelId: string, username: string) => {
        if (!nextChannelId || nextChannelId === channelIdRef.current) return;
        if (channelIdRef.current) leaveChannel();
        usernameRef.current = username;
        
        try {
            const rawStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
            const AudioCtxClass = (window.AudioContext || (window as any).webkitAudioContext);
            const audioCtx = new AudioCtxClass();
            if (audioCtx.state === 'suspended') await audioCtx.resume();
            const source = audioCtx.createMediaStreamSource(rawStream);
            const dest = audioCtx.createMediaStreamDestination();
            try {
                await audioCtx.audioWorklet.addModule('/worker/noise-gate.worklet.js').catch(e => { console.warn("Worklet module load failed", e); throw e; });
                const node = new AudioWorkletNode(audioCtx, 'noise-gate-processor');
                node.port.postMessage({ type: 'INIT_WASM', wasmJsPath: '/src/pkg/core_wasm.js', wasmBinPath: '/src/pkg/core_wasm_bg.wasm', threshold: 0.05, attack: 0.003, release: 0.05 });
                source.connect(node);
                node.connect(dest);
            } catch (e) { console.warn("AudioWorklet failed, fallback to raw audio", e); source.connect(dest); }
            localStreamRef.current = dest.stream;
            setLocalStream(dest.stream);

            channelIdRef.current = nextChannelId;
            setChannelId(nextChannelId);
            
            if (socketRef.current?.readyState === WebSocket.OPEN) {
                sendSignal({ type: 'join', channelId: nextChannelId, userId: userIdRef.current, username });
            } else {
                connectSocket();
            }
        } catch (err) { console.error("Join error", err); setError("Erreur micro"); }
    }, [leaveChannel, sendSignal, connectSocket]);

    const toggleMute = useCallback(() => {
        const next = !isMuted;
        if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !next);
        setIsMuted(next);
        setParticipants(p => p.map(part => part.userId === userIdRef.current ? { ...part, isMuted: next } : part));
        if (channelIdRef.current) sendSignal({ type: 'media-state', channelId: channelIdRef.current, userId: userIdRef.current, isMuted: next, isDeafened });
    }, [isMuted, isDeafened, sendSignal]);

    const toggleDeafen = useCallback(() => {
        const next = !isDeafened;
        setIsDeafened(next);
        setIsMuted(next);
        if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !next);
        setParticipants(p => p.map(part => part.userId === userIdRef.current ? { ...part, isDeafened: next, isMuted: next } : part));
        if (channelIdRef.current) sendSignal({ type: 'media-state', channelId: channelIdRef.current, userId: userIdRef.current, isMuted: next, isDeafened: next });
    }, [isDeafened, sendSignal]);

    const sendChatMessage = useCallback((message: string) => {
        if (!channelIdRef.current || !message.trim()) return;
        sendSignal({ type: 'chat', channelId: channelIdRef.current, from: userIdRef.current, username: usernameRef.current, message, timestamp: Date.now() });
    }, [sendSignal]);

    const value = useMemo(() => ({
        channelId, participants, isConnected, isMuted, isDeafened, error,
        localUserId: userIdRef.current, localStream, joinChannel, leaveChannel,
        toggleMute, toggleDeafen, remoteStreams, remoteVideoStreams: new Map(),
        addScreenTrack: (s: MediaStream) => { screenStreamRef.current = s; }, 
        removeScreenTrack: () => { screenStreamRef.current = null; },
        userVolumes, setUserVolume: (id: string, vol: number) => setUserVolumes(p => new Map(p).set(id, vol)),
        networkQuality, ping, chatMessages, sendChatMessage,
    }), [channelId, participants, isConnected, isMuted, isDeafened, error, localStream, joinChannel, leaveChannel, toggleMute, toggleDeafen, remoteStreams, userVolumes, networkQuality, ping, chatMessages, sendChatMessage]);

    return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
};

export const useVoiceStore = () => {
    const context = useContext(VoiceContext);
    if (!context) throw new Error('useVoiceStore must be used within VoiceProvider');
    return context;
};

function buildUserId() { return `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
