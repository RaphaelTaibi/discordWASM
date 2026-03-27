import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ClientSignalMessage } from '../types/clientSignal.type';
import { ServerSignalMessage } from '../types/serverSignal.type';
import VoicePeer from '../models/voicePeer.model';
import VoiceState from '../models/voiceState.model';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'ws://127.0.0.1:3001/ws';

const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    ...(import.meta.env.VITE_TURN_URL
        ? [{
            urls: import.meta.env.VITE_TURN_URL,
            username: import.meta.env.VITE_TURN_USER || '',
            credential: import.meta.env.VITE_TURN_PASS || '',
        }]
        : []),
];

const VoiceContext = createContext<VoiceState | undefined>(undefined);

const buildUserId = () => {
    const randomPart = Math.random().toString(36).slice(2, 10);
    return `user-${Date.now()}-${randomPart}`;
};

export const VoiceProvider = ({ children }: { children: ReactNode }) => {
    const [channelId, setChannelId] = useState<string | null>(null);
    const [participants, setParticipants] = useState<VoicePeer[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
    const [remoteVideoStreams, setRemoteVideoStreams] = useState<Map<string, MediaStream>>(new Map());

    const socketRef = useRef<WebSocket | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const userIdRef = useRef<string>(buildUserId());
    const usernameRef = useRef<string>('Anonymous');
    const channelIdRef = useRef<string | null>(null);

    const sendSignal = useCallback((payload: ClientSignalMessage) => {
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return;
        }
        socket.send(JSON.stringify(payload));
    }, []);

    const removePeerConnection = useCallback((peerId: string) => {
        const pc = peerConnectionsRef.current.get(peerId);
        if (pc) {
            pc.ontrack = null;
            pc.onicecandidate = null;
            pc.close();
            peerConnectionsRef.current.delete(peerId);
        }

        setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
        });

        setRemoteVideoStreams((prev) => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
        });

        setParticipants((prev) => prev.filter((peer) => peer.userId !== peerId));
    }, []);

    const createPeerConnection = useCallback((peer: VoicePeer) => {
        const existing = peerConnectionsRef.current.get(peer.userId);
        if (existing) {
            return existing;
        }

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        // Add audio tracks
        const localStream = localStreamRef.current;
        if (localStream) {
            for (const track of localStream.getTracks()) {
                pc.addTrack(track, localStream);
            }
        }

        // Add screen share video track if currently sharing
        const screenStream = screenStreamRef.current;
        if (screenStream) {
            for (const track of screenStream.getVideoTracks()) {
                pc.addTrack(track, screenStream);
            }
        }

        pc.onicecandidate = (event) => {
            if (!event.candidate || !channelIdRef.current) {
                return;
            }

            sendSignal({
                type: 'ice',
                channelId: channelIdRef.current,
                from: userIdRef.current,
                to: peer.userId,
                candidate: event.candidate.toJSON(),
            });
        };

        pc.ontrack = (event) => {
            const [stream] = event.streams;
            if (!stream) {
                return;
            }

            if (event.track.kind === 'audio') {
                setRemoteStreams((prev) => {
                    const next = new Map(prev);
                    next.set(peer.userId, stream);
                    return next;
                });
            } else if (event.track.kind === 'video') {
                setRemoteVideoStreams((prev) => {
                    const next = new Map(prev);
                    next.set(peer.userId, stream);
                    return next;
                });

                // Clean up when remote stops sharing
                event.track.onended = () => {
                    setRemoteVideoStreams((prev) => {
                        const next = new Map(prev);
                        next.delete(peer.userId);
                        return next;
                    });
                };
                event.track.onmute = () => {
                    setRemoteVideoStreams((prev) => {
                        const next = new Map(prev);
                        next.delete(peer.userId);
                        return next;
                    });
                };
                event.track.onunmute = () => {
                    setRemoteVideoStreams((prev) => {
                        const next = new Map(prev);
                        next.set(peer.userId, stream);
                        return next;
                    });
                };
            }
        };

        peerConnectionsRef.current.set(peer.userId, pc);

        setParticipants((prev) => {
            if (prev.some((p) => p.userId === peer.userId)) {
                return prev;
            }
            return [...prev, peer];
        });

        return pc;
    }, [sendSignal]);

    const handleOffer = useCallback(async (msg: Extract<ServerSignalMessage, { type: 'offer' }>) => {
        if (!channelIdRef.current || channelIdRef.current !== msg.channelId) {
            return;
        }

        const peer: VoicePeer = { userId: msg.from, username: msg.fromUsername };
        const pc = createPeerConnection(peer);

        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sendSignal({
            type: 'answer',
            channelId: msg.channelId,
            from: userIdRef.current,
            to: msg.from,
            sdp: answer,
        });
    }, [createPeerConnection, sendSignal]);

    const handleAnswer = useCallback(async (msg: Extract<ServerSignalMessage, { type: 'answer' }>) => {
        const pc = peerConnectionsRef.current.get(msg.from);
        if (!pc) {
            return;
        }
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    }, []);

    const handleIce = useCallback(async (msg: Extract<ServerSignalMessage, { type: 'ice' }>) => {
        const peer: VoicePeer = { userId: msg.from, username: msg.fromUsername };
        const pc = createPeerConnection(peer);
        await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
    }, [createPeerConnection]);

    const leaveChannel = useCallback(() => {
        const activeChannel = channelIdRef.current;
        if (activeChannel) {
            sendSignal({
                type: 'leave',
                channelId: activeChannel,
                userId: userIdRef.current,
            });
        }

        for (const peerId of peerConnectionsRef.current.keys()) {
            removePeerConnection(peerId);
        }

        const local = localStreamRef.current;
        if (local) {
            for (const track of local.getTracks()) {
                track.stop();
            }
        }

        localStreamRef.current = null;
        screenStreamRef.current = null;
        peerConnectionsRef.current.clear();

        const socket = socketRef.current;
        if (socket && socket.readyState <= WebSocket.OPEN) {
            socket.close();
        }

        socketRef.current = null;
        channelIdRef.current = null;
        setChannelId(null);
        setParticipants([]);
        setRemoteStreams(new Map());
        setRemoteVideoStreams(new Map());
        setIsConnected(false);
        setIsMuted(false);
        setIsDeafened(false);
    }, [removePeerConnection, sendSignal]);

    const joinChannel = useCallback(async (nextChannelId: string, username: string) => {
        if (!nextChannelId) {
            return;
        }

        if (channelIdRef.current) {
            leaveChannel();
        }

        setError(null);
        usernameRef.current = username || 'Anonymous';

        try {
            const localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            });

            localStreamRef.current = localStream;

            const socket = new WebSocket(SIGNALING_URL);
            socketRef.current = socket;

            socket.onopen = () => {
                channelIdRef.current = nextChannelId;
                setChannelId(nextChannelId);
                setParticipants([{ userId: userIdRef.current, username: usernameRef.current }]);

                sendSignal({
                    type: 'join',
                    channelId: nextChannelId,
                    userId: userIdRef.current,
                    username: usernameRef.current,
                });
            };

            socket.onmessage = async (event) => {
                const msg = JSON.parse(event.data) as ServerSignalMessage;

                if (msg.type === 'error') {
                    setError(msg.message);
                    return;
                }

                if (msg.type === 'joined') {
                    setIsConnected(true);
                    for (const peer of msg.peers) {
                        const pc = createPeerConnection(peer);
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        sendSignal({
                            type: 'offer',
                            channelId: msg.channelId,
                            from: userIdRef.current,
                            to: peer.userId,
                            sdp: offer,
                        });
                    }
                    return;
                }

                if (msg.type === 'peer-joined') {
                    setParticipants((prev) => {
                        if (prev.some((p) => p.userId === msg.peer.userId)) {
                            return prev;
                        }
                        return [...prev, msg.peer];
                    });
                    return;
                }

                if (msg.type === 'peer-left') {
                    removePeerConnection(msg.userId);
                    return;
                }

                if (msg.type === 'peer-state') {
                    setParticipants((prev) =>
                        prev.map((p) =>
                            p.userId === msg.userId
                                ? { ...p, isMuted: msg.isMuted, isDeafened: msg.isDeafened }
                                : p,
                        ),
                    );
                    return;
                }

                if (msg.type === 'offer') {
                    await handleOffer(msg);
                    return;
                }

                if (msg.type === 'answer') {
                    await handleAnswer(msg);
                    return;
                }

                if (msg.type === 'ice') {
                    await handleIce(msg);
                }
            };

            socket.onclose = () => {
                setIsConnected(false);
            };

            socket.onerror = () => {
                setError('Connexion signaling indisponible');
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Impossible d\'accéder au micro';
            setError(message);
            leaveChannel();
        }
    }, [createPeerConnection, handleAnswer, handleIce, handleOffer, leaveChannel, removePeerConnection, sendSignal]);

    const toggleMute = useCallback(() => {
        const local = localStreamRef.current;
        if (!local) {
            return;
        }

        const nextMuted = !isMuted;
        for (const track of local.getAudioTracks()) {
            track.enabled = !nextMuted;
        }
        setIsMuted(nextMuted);

        // Update local participant state
        setParticipants((prev) =>
            prev.map((p) =>
                p.userId === userIdRef.current ? { ...p, isMuted: nextMuted } : p,
            ),
        );

        // Broadcast to other peers
        if (channelIdRef.current) {
            sendSignal({
                type: 'media-state',
                channelId: channelIdRef.current,
                userId: userIdRef.current,
                isMuted: nextMuted,
                isDeafened,
            });
        }
    }, [isMuted, isDeafened, sendSignal]);

    const toggleDeafen = useCallback(() => {
        const nextDeafened = !isDeafened;
        setIsDeafened(nextDeafened);

        // Update local participant state
        setParticipants((prev) =>
            prev.map((p) =>
                p.userId === userIdRef.current ? { ...p, isDeafened: nextDeafened } : p,
            ),
        );

        // Broadcast to other peers
        if (channelIdRef.current) {
            sendSignal({
                type: 'media-state',
                channelId: channelIdRef.current,
                userId: userIdRef.current,
                isMuted,
                isDeafened: nextDeafened,
            });
        }
    }, [isMuted, isDeafened, sendSignal]);

    const renegotiateWithPeer = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
        if (!channelIdRef.current) return;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal({
            type: 'offer',
            channelId: channelIdRef.current,
            from: userIdRef.current,
            to: peerId,
            sdp: offer,
        });
    }, [sendSignal]);

    const addScreenTrack = useCallback((screenStream: MediaStream) => {
        screenStreamRef.current = screenStream;
        const videoTrack = screenStream.getVideoTracks()[0];
        if (!videoTrack) return;

        for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
            // Don't add if already has a video sender with a track
            const hasVideo = pc.getSenders().some((s) => s.track?.kind === 'video');
            if (!hasVideo) {
                pc.addTrack(videoTrack, screenStream);
            }
            renegotiateWithPeer(peerId, pc);
        }
    }, [renegotiateWithPeer]);

    const removeScreenTrack = useCallback(() => {
        screenStreamRef.current = null;

        for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
            const senders = pc.getSenders();
            for (const sender of senders) {
                if (sender.track?.kind === 'video') {
                    pc.removeTrack(sender);
                }
            }
            renegotiateWithPeer(peerId, pc);
        }
    }, [renegotiateWithPeer]);

    const value = useMemo<VoiceState>(() => ({
        channelId,
        participants,
        isConnected,
        isMuted,
        isDeafened,
        error,
        joinChannel,
        leaveChannel,
        toggleMute,
        toggleDeafen,
        remoteStreams,
        remoteVideoStreams,
        addScreenTrack,
        removeScreenTrack,
    }), [channelId, participants, isConnected, isMuted, isDeafened, error, joinChannel, leaveChannel, toggleMute, toggleDeafen, remoteStreams, remoteVideoStreams, addScreenTrack, removeScreenTrack]);

    return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
};

export const useVoiceStore = () => {
    const context = useContext(VoiceContext);
    if (!context) {
        throw new Error('useVoiceStore must be used within VoiceProvider');
    }
    return context;
};

