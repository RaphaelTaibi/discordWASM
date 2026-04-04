import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ClientSignalMessage } from '../types/clientSignal.type';
import { ServerSignal } from '../types/serverSignal.type';
import VoicePeer from '../models/voicePeer.model';
import ChatMessage from '../models/chatMessage.model';
import ExtendedVoiceState from '../models/extendedVoiceState.model';
import initWasm, { calculate_network_quality } from '../pkg/core_wasm';
import { invoke } from '@tauri-apps/api/core';
import WebSocket from '@tauri-apps/plugin-websocket';
import { useToast } from './ToastContext';

const RAW_URL = import.meta.env.VITE_SIGNALING_URL || "wss://127.0.0.1:3001/ws";
const SIGNALING_URL = RAW_URL.replace(/^["']/, "").replace(/["']$/, "").trim();

const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

const VoiceContext = createContext<ExtendedVoiceState | undefined>(undefined);

export const VoiceProvider = ({ children }: { children: ReactNode }) => {
    const [channelId, setChannelId] = useState<string | null>(null);
    const [participants, setParticipants] = useState<VoicePeer[]>([]);
    const [channelStartedAt, setChannelStartedAt] = useState<number | undefined>(undefined);
    const [isConnected, setIsConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
    const [remoteVideoStreams, setRemoteVideoStreams] = useState<Map<string, MediaStream>>(new Map());
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [userVolumes, setUserVolumes] = useState<Map<string, number>>(new Map());
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

    const [networkQuality, setNetworkQuality] = useState<0 | 1 | 2 | 3>(3);
    const [ping, setPing] = useState<number>(0);
    const [wasmReady, setWasmReady] = useState(false);

    const [localUserId, setLocalUserId] = useState<string>("");
    const [localUsername, setLocalUsername] = useState<string>("");

    const { addToast } = useToast();

    // Mapping from trackId -> userId
    const trackToUserMapRef = useRef<Map<string, string>>(new Map());

    // Utilisation du type WebSocket de Tauri
    const socketRef = useRef<WebSocket | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const localAudioCtxRef = useRef<AudioContext | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    
    // SFU: Single connection to the server
    const sfuConnectionRef = useRef<RTCPeerConnection | null>(null);

    const userIdRef = useRef<string>("");
    const usernameRef = useRef<string>("");
    const channelIdRef = useRef<string | null>(null);
    const signalQueueRef = useRef<ClientSignalMessage[]>([]);

    const [smartGateEnabled, setSmartGateEnabled] = useState(true);

    useEffect(() => { userIdRef.current = localUserId; }, [localUserId]);
    useEffect(() => { usernameRef.current = localUsername; }, [localUsername]);

    const sendSignal = useCallback(async (payload: ClientSignalMessage) => {
        if (socketRef.current) {
            try {
                await socketRef.current.send(JSON.stringify(payload));
            } catch (err) {
                console.error("Erreur envoi signal:", err);
            }
        } else {
            signalQueueRef.current.push(payload);
        }
    }, []);

    const removeScreenTrack = useCallback(() => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;
        }
        // SFU architecture does not require removing tracks from peer connections manually
    }, []);

    const addScreenTrack = useCallback(async (stream: MediaStream) => {
        screenStreamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.onended = () => removeScreenTrack();
            if (sfuConnectionRef.current) {
                sfuConnectionRef.current.addTrack(videoTrack, stream);
            }
        }
    }, [removeScreenTrack]);

    const connectSFU = useCallback(async () => {
        if (sfuConnectionRef.current) {
            sfuConnectionRef.current.close();
        }

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        sfuConnectionRef.current = pc;

        // Add local media tracks
        const local = localStreamRef.current;
        if (local) {
            local.getAudioTracks().forEach(t => pc.addTrack(t, local));
        }

        const screen = screenStreamRef.current;
        if (screen) {
            screen.getVideoTracks().forEach(t => pc.addTrack(t, screen));
        }

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                sendSignal({ type: 'ice', candidate: e.candidate.toJSON() } as any);
            }
        };

        pc.ontrack = (e) => {
            if (e.streams && e.streams[0]) {
                const stream = e.streams[0];
                const track = e.track;

                const uid = trackToUserMapRef.current.get(track.id);
                if (uid) {
                    if (track.kind === 'audio') {
                        setRemoteStreams(r => new Map(r).set(uid, stream));
                    } else if (track.kind === 'video') {
                        setRemoteVideoStreams(r => new Map(r).set(uid, stream));
                    }
                } else {
                    // Store the stream temporarily by stream.id if mapping hasn't arrived
                    if (track.kind === 'audio') {
                        setRemoteStreams(r => new Map(r).set(stream.id, stream));
                    } else if (track.kind === 'video') {
                        setRemoteVideoStreams(r => new Map(r).set(stream.id, stream));
                    }
                }
            }
        };

        pc.onnegotiationneeded = async () => {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                sendSignal({ type: 'offer', sdp: offer } as any);
            } catch (err) { console.error("RTC negotiation error:", err); }
        };

        // Supprimé : On ne force plus la négociation manuelle en fin de fonction, car 'onnegotiationneeded' se déclenchera automatiquement dès qu'on ajoute des tracks (addTrack), ce qui causait le conflit des m-lines (InvalidAccessError).
    }, [sendSignal]);

    // Logique de traitement des messages entrants (centralisé)
    const handleMessage = useCallback(async (data: string) => {
        try {
            const msg = JSON.parse(data) as ServerSignal;
            switch (msg.type) {
                case 'joined':
                    if (msg.channelId !== 'global') {
                        const peers = msg.peers.map((p: any) => ({
                            ...p,
                            isMuted: !!p.isMuted,
                            isDeafened: !!p.isDeafened
                        }));
                        setParticipants([
                            { userId: userIdRef.current, username: usernameRef.current, isMuted: false, isDeafened: false },
                            ...peers
                        ]);
                        setChannelStartedAt(msg.startedAt);
                        // Only connect SFU once when joined
                        connectSFU();
                    }
                    break;
                case 'peer-joined':
                    const peer = {
                        ...msg.peer,
                        isMuted: !!msg.peer.isMuted,
                        isDeafened: !!msg.peer.isDeafened
                    };
                    setParticipants(p => p.some(part => part.userId === peer.userId) ? p : [...p, peer]);
                    addToast(`${msg.peer.username} a rejoint le salon`, 'join');
                    // SFU connection is already active, we don't create a new one per peer
                    break;
                case 'peer-left':
                    setParticipants(p => {
                        const leavingPeer = p.find(part => part.userId === msg.userId);
                        if (leavingPeer) {
                            addToast(`${leavingPeer.username} a quitté le salon`, 'leave');
                        }
                        return p.filter(part => part.userId !== msg.userId);
                    });
                    // We don't remove streams here by userId directly unless we mapped them,
                    // but the SFU will stop sending the tracks.
                    break;
                case 'peer-state':
                    setParticipants(p => p.map(part => part.userId === msg.userId ? { ...part, isMuted: msg.isMuted, isDeafened: msg.isDeafened } : part));
                    break;
                case 'track-map':
                    trackToUserMapRef.current.set(msg.trackId, msg.userId);
                    
                    // Also try to move streams from stream.id to userId if it arrived before the map
                    setRemoteStreams(prev => {
                        if (prev.has(msg.streamId)) {
                            const stream = prev.get(msg.streamId)!;
                            const newMap = new Map(prev);
                            newMap.set(msg.userId, stream);
                            // We can choose to delete the old generic streamId mapping, or keep it.
                            return newMap;
                        }
                        return prev;
                    });
                    setRemoteVideoStreams(prev => {
                        if (prev.has(msg.streamId)) {
                            const stream = prev.get(msg.streamId)!;
                            const newMap = new Map(prev);
                            newMap.set(msg.userId, stream);
                            return newMap;
                        }
                        return prev;
                    });
                    break;
                case 'offer': // If SFU initiates an offer
                    if (!sfuConnectionRef.current) connectSFU();
                    const pcOffer = sfuConnectionRef.current!;
                    await pcOffer.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                    const answer = await pcOffer.createAnswer();
                    await pcOffer.setLocalDescription(answer);
                    sendSignal({ type: 'answer', sdp: answer } as any);
                    break;
                case 'answer':
                    const pcAnswer = sfuConnectionRef.current;
                    if (pcAnswer) await pcAnswer.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                    break;
                case 'ice':
                    const pcIce = sfuConnectionRef.current;
                    if (pcIce && msg.candidate) await pcIce.addIceCandidate(new RTCIceCandidate(msg.candidate));
                    break;
                case 'chat':
                    setChatMessages(prev => {
                        const id = `${msg.from}-${msg.timestamp}`;
                        if (prev.some(m => m.id === id)) return prev;
                        return [...prev, { id, from: msg.from, username: msg.username, message: msg.message, timestamp: Number(msg.timestamp) }];
                    });
                    break;
            }
        } catch (e) { console.error("Signal parsing error:", e); }
    }, [connectSFU, sendSignal, addToast]);

    const connectSocket = useCallback(async () => {
        if (!userIdRef.current || socketRef.current) return;

        try {
            // Créer une URL HTTPS basée sur l'URL WSS pour faire le check de pinning avec reqwest
            const checkUrl = SIGNALING_URL.replace(/^wss?:\/\//, (match: string) => match === 'wss://' ? 'https://' : 'http://').replace(/\/ws$/, '/health');
            
            // SÉCURITÉ : Validation SSL Pinning via le backend Rust
            await invoke('call_signaling', { url: checkUrl });
            console.log("✅ Pinning validé. Connexion via plugin Tauri...");

            // CONNEXION via le plugin Tauri (pour bypasser les sécurités WebView)
            const socket = await WebSocket.connect(SIGNALING_URL);
            socketRef.current = socket;
            setIsConnected(true);

            // Listener de messages version Plugin Tauri
            await socket.addListener((msg) => {
                if (msg.type === 'Text') handleMessage(msg.data);
            });

            // Une fois connecté, on rejoint le canal
            const initialJoin: ClientSignalMessage = {
                type: 'join',
                channelId: channelIdRef.current || 'global',
                userId: userIdRef.current,
                username: usernameRef.current
            };
            await socket.send(JSON.stringify(initialJoin));

            // Vider la queue
            while (signalQueueRef.current.length > 0) {
                const signal = signalQueueRef.current.shift();
                if (signal) await socket.send(JSON.stringify(signal));
            }

        } catch (err) {
            console.error("❌ Échec connexion/pinning:", err);
            setIsConnected(false);
            socketRef.current = null;
            setTimeout(connectSocket, 5000); // Retry
        }
    }, [handleMessage]);

    const setUserInfo = useCallback((username: string, userId: string) => {
        if (!username || !userId) return;
        setLocalUsername(username);
        setLocalUserId(userId);
        usernameRef.current = username;
        userIdRef.current = userId;
        connectSocket();
    }, [connectSocket]);

    const toggleMute = useCallback(() => {
        const next = !isMuted;
        if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !next);
        setIsMuted(next);
        setParticipants(p => p.map(part => part.userId === userIdRef.current ? { ...part, isMuted: next } : part));
        if (channelIdRef.current) {
            sendSignal({ type: 'media-state', channelId: channelIdRef.current, userId: userIdRef.current, isMuted: next, isDeafened });
        }
    }, [isMuted, isDeafened, sendSignal]);

    const toggleDeafen = useCallback(() => {
        const next = !isDeafened;
        const nextMute = next || isMuted;
        setIsDeafened(next);
        setParticipants(p => p.map(part => part.userId === userIdRef.current ? { ...part, isDeafened: next, isMuted: nextMute } : part));
        if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !nextMute);
        if (channelIdRef.current) {
            sendSignal({ type: 'media-state', channelId: channelIdRef.current, userId: userIdRef.current, isMuted: nextMute, isDeafened: next });
        }
    }, [isDeafened, isMuted, sendSignal]);

    const joinChannel = useCallback(async (nextChannelId: string, username: string) => {
        if (!nextChannelId || nextChannelId === channelIdRef.current) return;
        const prevChannel = channelIdRef.current || 'global';
        sendSignal({ type: 'leave', channelId: prevChannel, userId: userIdRef.current });

        try {
            const rawStream = await navigator.mediaDevices.getUserMedia({ audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            } });

            const audioCtx = new window.AudioContext();
            const source = audioCtx.createMediaStreamSource(rawStream);
            const destination = audioCtx.createMediaStreamDestination();

            await audioCtx.audioWorklet.addModule('/worker/noise-gate.worklet.js');
            const noiseGateNode = new AudioWorkletNode(audioCtx, 'noise-gate-processor');
            
            noiseGateNode.port.postMessage({
                type: 'INIT_WASM',
                wasmJsPath: '/pkg/core_wasm.js',
                wasmBinPath: '/pkg/core_wasm_bg.wasm',
                threshold: 0.13,
                attack: 0.01,
                release: 0.1
            });

            if (smartGateEnabled) {
                source.connect(noiseGateNode);
                noiseGateNode.connect(destination);
            } else {
                source.connect(destination);
            }

            const gateStream = destination.stream;

            // Garde une référence pour pouvoir le fermer plus tard
            localAudioCtxRef.current = audioCtx;
            localStreamRef.current = gateStream;
            setLocalStream(gateStream);
            channelIdRef.current = nextChannelId;
            setChannelId(nextChannelId);
            sendSignal({ type: 'join', channelId: nextChannelId, userId: userIdRef.current, username });
        } catch (err) { setError("Microphone inaccessible"); }
    }, [sendSignal, smartGateEnabled]);

    const leaveChannel = useCallback(() => {
        if (channelIdRef.current) {
            sendSignal({ type: 'leave', channelId: channelIdRef.current, userId: userIdRef.current });
            sendSignal({ type: 'join', channelId: 'global', userId: userIdRef.current, username: usernameRef.current });
        }
        
        if (sfuConnectionRef.current) {
            sfuConnectionRef.current.close();
            sfuConnectionRef.current = null;
        }
        
        if (localAudioCtxRef.current) {
            localAudioCtxRef.current.close();
            localAudioCtxRef.current = null;
        }

        if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
        if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        setChannelId(null);
        channelIdRef.current = null;
        setParticipants([]);
        setChannelStartedAt(undefined);
        remoteStreams.forEach(stream => stream.getTracks().forEach(t => t.stop()));
        setRemoteStreams(new Map());
        setRemoteVideoStreams(new Map());
    }, [sendSignal]);

    const sendChatMessage = useCallback((message: string) => {
        if (!message.trim()) return;
        sendSignal({
            type: 'chat',
            channelId: 'global-chat',
            from: userIdRef.current,
            username: usernameRef.current,
            message,
            timestamp: Date.now()
        });
    }, [sendSignal]);

    useEffect(() => {
        initWasm().then(() => setWasmReady(true)).catch(() => setWasmReady(true));
        // Cleanup asynchrone pour le plugin
        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    useEffect(() => {
        if (!isConnected || !wasmReady) return;
        const interval = setInterval(async () => {
            try {
                let totalRTT = 0, count = 0, totalLoss = 0, totalJitter = 0;
                const pc = sfuConnectionRef.current;
                if (pc && (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed')) {
                    const stats = await pc.getStats();
                    let candidatePairRTT: number | undefined;

                    stats.forEach(r => {
                        // Gather candidate-pair RTT as fallback
                        if (r.type === 'candidate-pair' && (r.state === 'succeeded' || r.nominated) && r.currentRoundTripTime !== undefined) {
                            candidatePairRTT = r.currentRoundTripTime * 1000;
                        }
                        if (r.type === 'remote-inbound-rtp' && r.roundTripTime !== undefined) { 
                            totalRTT += r.roundTripTime * 1000; 
                            count++; 
                        }
                        if (r.type === 'inbound-rtp' && r.kind === 'audio') {
                            const total = (r.packetsLost || 0) + (r.packetsReceived || 0);
                            if (total > 0) {
                                totalLoss += (r.packetsLost || 0) / total;
                            }
                            if (r.jitter !== undefined) totalJitter += r.jitter * 1000;
                        }
                    });

                    const countDiv = Math.max(1, count);
                    let finalRTT = 0;
                    if (count > 0) {
                        finalRTT = totalRTT / count;
                    } else if (candidatePairRTT !== undefined) {
                        finalRTT = candidatePairRTT;
                    } else {
                        // Ultime fallback: chercher n'importe quel RTT dans les stats
                        stats.forEach(r => {
                            if (r.roundTripTime !== undefined) finalRTT = r.roundTripTime * 1000;
                            else if (r.currentRoundTripTime !== undefined) finalRTT = r.currentRoundTripTime * 1000;
                        });
                    }

                    if (finalRTT > 0) {
                        setPing(Math.max(1, Math.round(finalRTT)));
                        if (typeof calculate_network_quality === 'function') {
                            setNetworkQuality(calculate_network_quality(finalRTT, totalLoss / countDiv, totalJitter / countDiv) as 0 | 1 | 2 | 3);
                        }
                    }
                }
            } catch (e) { }
        }, 2000);
        return () => clearInterval(interval);
    }, [isConnected, wasmReady]);

    const value = useMemo(() => ({
        channelId, participants, isConnected, isMuted, isDeafened, error,
        localUserId: userIdRef.current,
        localStream,
        channelStartedAt,
        joinChannel,
        leaveChannel,
        toggleMute, toggleDeafen,
        remoteStreams, remoteVideoStreams,
        addScreenTrack, removeScreenTrack,
        userVolumes, setUserVolume: (id: string, vol: number) => setUserVolumes(p => new Map(p).set(id, vol)),
        networkQuality, ping, chatMessages, sendChatMessage, setUserInfo,
        smartGateEnabled, setSmartGateEnabled
    }), [channelId, participants, isConnected, isMuted, isDeafened, error, localUserId, localStream, channelStartedAt, joinChannel, leaveChannel, toggleMute, toggleDeafen, remoteStreams, remoteVideoStreams, addScreenTrack, removeScreenTrack, userVolumes, networkQuality, ping, chatMessages, sendChatMessage, setUserInfo, smartGateEnabled]);

    return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
};

export const useVoiceStore = () => {
    const ctx = useContext(VoiceContext);
    if (!ctx) throw new Error("useVoiceStore must be used within VoiceProvider");
    return ctx;
};
