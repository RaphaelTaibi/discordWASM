import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ClientSignalMessage } from '../types/clientSignal.type';
import { ServerSignalMessage } from '../types/serverSignal.type';
import VoicePeer from '../models/voicePeer.model';
import ChatMessage from '../models/chatMessage.model';
import ExtendedVoiceState from '../models/extendedVoiceState.model';
import { useToast } from './ToastContext';
import initWasm, { calculate_network_quality } from '../pkg/core_wasm';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL

const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

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
    const [remoteVideoStreams, setRemoteVideoStreams] = useState<Map<string, MediaStream>>(new Map());
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [userVolumes, setUserVolumes] = useState<Map<string, number>>(new Map());
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

    const [networkQuality, setNetworkQuality] = useState<0 | 1 | 2 | 3>(3);
    const [ping, setPing] = useState<number>(0);
    const [wasmReady, setWasmReady] = useState(false);

    const [localUserId, setLocalUserId] = useState<string>("");
    const [localUsername, setLocalUsername] = useState<string>("");

    const socketRef = useRef<WebSocket | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    
    const userIdRef = useRef<string>("");
    const usernameRef = useRef<string>("");
    const channelIdRef = useRef<string | null>(null);
    const signalQueueRef = useRef<ClientSignalMessage[]>([]);

    useEffect(() => { userIdRef.current = localUserId; }, [localUserId]);
    useEffect(() => { usernameRef.current = localUsername; }, [localUsername]);

    const sendSignal = useCallback((payload: ClientSignalMessage) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify(payload));
        } else {
            signalQueueRef.current.push(payload);
        }
    }, []);

    const removeScreenTrack = useCallback(() => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;
        }
        peerConnectionsRef.current.forEach(pc => {
            const senders = pc.getSenders();
            senders.forEach(sender => {
                if (sender.track?.kind === 'video') {
                    pc.removeTrack(sender);
                }
            });
        });
    }, []);

    const addScreenTrack = useCallback(async (stream: MediaStream) => {
        screenStreamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.onended = () => removeScreenTrack();
            peerConnectionsRef.current.forEach(pc => {
                pc.addTrack(videoTrack, stream);
            });
        }
    }, [removeScreenTrack]);

    const createPeerConnection = useCallback((peer: VoicePeer) => {
        let pc = peerConnectionsRef.current.get(peer.userId);
        if (!pc) {
            pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            const local = localStreamRef.current;
            if (local) local.getAudioTracks().forEach(t => pc!.addTrack(t, local));
            
            const screen = screenStreamRef.current;
            if (screen) screen.getVideoTracks().forEach(t => pc!.addTrack(t, screen));

            pc.onicecandidate = (e) => { 
                if (e.candidate && channelIdRef.current) {
                    sendSignal({ type: 'ice', channelId: channelIdRef.current, from: userIdRef.current, to: peer.userId, candidate: e.candidate.toJSON() });
                }
            };
            
            pc.ontrack = (e) => { 
                if (e.streams && e.streams[0]) {
                    if (e.track.kind === 'audio') {
                        setRemoteStreams(prev => new Map(prev).set(peer.userId, e.streams[0]));
                    } else if (e.track.kind === 'video') {
                        setRemoteVideoStreams(prev => new Map(prev).set(peer.userId, e.streams[0]));
                    }
                }
            };

            pc.onnegotiationneeded = async () => {
                // Pour éviter les conflits, on laisse celui qui a l'ID le plus petit initier
                // MAIS si on a un stream vidéo, on veut pouvoir l'initier aussi
                if (userIdRef.current > peer.userId && !screenStreamRef.current) return;
                
                try {
                    const offer = await pc!.createOffer();
                    await pc!.setLocalDescription(offer);
                    if (channelIdRef.current) {
                        sendSignal({ type: 'offer', channelId: channelIdRef.current, from: userIdRef.current, to: peer.userId, sdp: offer });
                    }
                } catch (err) { console.error("RTC negotiation error:", err); }
            };
            peerConnectionsRef.current.set(peer.userId, pc);
        }
        return pc;
    }, [sendSignal]);

    const connectSocket = useCallback(() => {
        if (!userIdRef.current || (socketRef.current && socketRef.current.readyState <= 1)) return;
        
        const socket = new WebSocket(SIGNALING_URL);
        socketRef.current = socket;

        socket.onopen = () => {
            setIsConnected(true);
            const initialJoin: ClientSignalMessage = { 
                type: 'join', 
                channelId: channelIdRef.current || 'global', 
                userId: userIdRef.current, 
                username: usernameRef.current 
            };
            socket.send(JSON.stringify(initialJoin));

            while (signalQueueRef.current.length > 0) {
                const signal = signalQueueRef.current.shift();
                if (signal) {
                    if (signal.type === 'join' && signal.channelId === initialJoin.channelId) continue;
                    socket.send(JSON.stringify(signal));
                }
            }
        };

        socket.onmessage = async (event) => {
            try {
                const msg = JSON.parse(event.data) as ServerSignalMessage;
                switch (msg.type) {
                    case 'joined':
                        if (msg.channelId !== 'global') {
                            const peers = msg.peers.map(p => ({
                                ...p,
                                isMuted: typeof p.isMuted === 'boolean' ? p.isMuted : false,
                                isDeafened: typeof p.isDeafened === 'boolean' ? p.isDeafened : false
                            }));
                            setParticipants([
                                { userId: userIdRef.current, username: usernameRef.current, isMuted: false, isDeafened: false },
                                ...peers
                            ]);
                            peers.forEach(p => createPeerConnection(p));
                        }
                        break;
                    case 'peer-joined':
                        const peer = {
                            ...msg.peer,
                            isMuted: typeof msg.peer.isMuted === 'boolean' ? msg.peer.isMuted : false,
                            isDeafened: typeof msg.peer.isDeafened === 'boolean' ? msg.peer.isDeafened : false
                        };
                        setParticipants(p => p.some(part => part.userId === peer.userId) ? p : [...p, peer]);
                        createPeerConnection(peer);
                        break;
                    case 'peer-left':
                        const pc = peerConnectionsRef.current.get(msg.userId);
                        if (pc) { pc.close(); peerConnectionsRef.current.delete(msg.userId); }
                        setParticipants(p => p.filter(part => part.userId !== msg.userId));
                        setRemoteStreams(p => { const n = new Map(p); n.delete(msg.userId); return n; });
                        setRemoteVideoStreams(p => { const n = new Map(p); n.delete(msg.userId); return n; });
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
                        if (pcAnswer && (pcAnswer.signalingState === 'have-local-offer' || pcAnswer.signalingState === 'have-remote-offer')) {
                            await pcAnswer.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                        }
                        break;
                    case 'ice':
                        const pcIce = peerConnectionsRef.current.get(msg.from);
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
            } catch (e) { }
        };

        socket.onclose = () => {
            setIsConnected(false);
            socketRef.current = null;
            setTimeout(connectSocket, 3000);
        };
    }, [addToast, createPeerConnection, sendSignal]);

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
            const rawStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = rawStream;
            setLocalStream(rawStream);
            channelIdRef.current = nextChannelId;
            setChannelId(nextChannelId);
            sendSignal({ type: 'join', channelId: nextChannelId, userId: userIdRef.current, username });
        } catch (err) { setError("Microphone inaccessible"); }
    }, [sendSignal]);

    const leaveChannel = useCallback(() => {
        if (channelIdRef.current) {
            sendSignal({ type: 'leave', channelId: channelIdRef.current, userId: userIdRef.current });
            sendSignal({ type: 'join', channelId: 'global', userId: userIdRef.current, username: usernameRef.current });
        }
        peerConnectionsRef.current.forEach(pc => pc.close());
        peerConnectionsRef.current.clear();
        if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
        if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        setChannelId(null);
        channelIdRef.current = null;
        setParticipants([]);
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
        return () => { socketRef.current?.close(); };
    }, []);

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
            } catch (e) { }
        }, 2000);
        return () => clearInterval(interval);
    }, [isConnected, wasmReady]);

    const value = useMemo(() => ({
        channelId, participants, isConnected, isMuted, isDeafened, error,
        localUserId, localStream, joinChannel, leaveChannel,
        toggleMute, toggleDeafen,
        remoteStreams, remoteVideoStreams,
        addScreenTrack, removeScreenTrack,
        userVolumes, setUserVolume: (id: string, vol: number) => setUserVolumes(p => new Map(p).set(id, vol)),
        networkQuality, ping, chatMessages, sendChatMessage, setUserInfo
    }), [channelId, participants, isConnected, isMuted, isDeafened, error, localUserId, localStream, joinChannel, leaveChannel, toggleMute, toggleDeafen, remoteStreams, remoteVideoStreams, addScreenTrack, removeScreenTrack, userVolumes, networkQuality, ping, chatMessages, sendChatMessage, setUserInfo]);

    return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
};

export const useVoiceStore = () => {
    const context = useContext(VoiceContext);
    if (!context) throw new Error('useVoiceStore must be used within VoiceProvider');
    return context;
};
