import { useCallback, useRef } from 'react';
import { ServerSignal } from '../types/serverSignal.type';
import UseSfuConnectionProps from '../models/voice/useSfuConnectionProps.model';
import { emitSignalingEvent } from '../lib/signalingBus';

const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * Manages the single SFU peer-connection, screen-track lifecycle,
 * and dispatching of incoming signaling messages.
 */
export function useSfuConnection({
    sendSignal, localStreamRef, userIdRef, usernameRef, addToast,
    setParticipants, setChannelStartedAt, setRemoteStreams,
    setRemoteVideoStreams, setChatMessages, setBandwidthStats, setError,
}: UseSfuConnectionProps) {

    const sfuConnectionRef = useRef<RTCPeerConnection | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const trackToUserMapRef = useRef<Map<string, string>>(new Map());
    /** Streams that arrived via `ontrack` before their `track-map` mapping. */
    const orphanStreamsRef = useRef<Map<string, { stream: MediaStream; kind: string }>>(new Map());
    /** Track-maps received before their corresponding `ontrack` event. */
    const pendingTrackMapsRef = useRef<Map<string, { userId: string; kind: string }>>(new Map());

    const removeScreenTrack = useCallback(() => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;
        }
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
        if (sfuConnectionRef.current) sfuConnectionRef.current.close();

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        sfuConnectionRef.current = pc;

        const local = localStreamRef.current;
        if (local) local.getAudioTracks().forEach(t => pc.addTrack(t, local));

        const screen = screenStreamRef.current;
        if (screen) screen.getVideoTracks().forEach(t => pc.addTrack(t, screen));

        pc.onicecandidate = (e) => {
            if (e.candidate) sendSignal({ type: 'ice', candidate: e.candidate.toJSON() } as any);
        };

        pc.ontrack = (e) => {
            if (!e.streams?.[0]) return;
            const stream = e.streams[0];
            const track = e.track;
            // Lookup by track id first (most reliable), fall back to stream id
            // because the SFU's track-map references the source track id.
            const uid = trackToUserMapRef.current.get(track.id)
                || trackToUserMapRef.current.get(stream.id);

            if (uid) {
                if (track.kind === 'audio') setRemoteStreams(r => new Map(r).set(uid, stream));
                else if (track.kind === 'video') setRemoteVideoStreams(r => new Map(r).set(uid, stream));
                return;
            }

            // No mapping yet — buffer the stream and check pending track-maps
            const _pendingByTrack = pendingTrackMapsRef.current.get(track.id);
            const _pendingByStream = pendingTrackMapsRef.current.get(stream.id);
            const _pending = _pendingByTrack ?? _pendingByStream;
            if (_pending) {
                trackToUserMapRef.current.set(track.id, _pending.userId);
                trackToUserMapRef.current.set(stream.id, _pending.userId);
                if (track.kind === 'audio') setRemoteStreams(r => new Map(r).set(_pending.userId, stream));
                else if (track.kind === 'video') setRemoteVideoStreams(r => new Map(r).set(_pending.userId, stream));
                pendingTrackMapsRef.current.delete(track.id);
                pendingTrackMapsRef.current.delete(stream.id);
                return;
            }

            // Buffer as orphan — the track-map will resolve it shortly
            orphanStreamsRef.current.set(track.id, { stream, kind: track.kind });
            orphanStreamsRef.current.set(stream.id, { stream, kind: track.kind });
        };

        pc.onnegotiationneeded = async () => {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                sendSignal({ type: 'offer', sdp: offer } as any);
            } catch (err) { console.error("RTC negotiation error:", err); }
        };
    }, [sendSignal, localStreamRef, setRemoteStreams, setRemoteVideoStreams]);

    /** Dispatches every incoming server signal to the appropriate state updater. */
    const handleMessage = useCallback(async (data: string) => {
        try {
            const msg = JSON.parse(data) as ServerSignal;
            switch (msg.type) {
                case 'joined':
                    if (msg.channelId !== 'global') {
                        const peers = msg.peers.map((p: any) => ({
                            ...p, isMuted: !!p.isMuted, isDeafened: !!p.isDeafened,
                        }));
                        setParticipants([
                            { userId: userIdRef.current, username: usernameRef.current, isMuted: false, isDeafened: false },
                            ...peers,
                        ]);
                        setChannelStartedAt(msg.startedAt);
                        connectSFU();
                    }
                    break;
                case 'peer-joined': {
                    // Suppress global presence toasts — they leak presence of any
                    // user (incl. non-friends) and create noise outside vocal rooms.
                    if (msg.channelId === 'global') break;
                    const peer = { ...msg.peer, isMuted: !!msg.peer.isMuted, isDeafened: !!msg.peer.isDeafened };
                    setParticipants(p => p.some(part => part.userId === peer.userId) ? p : [...p, peer]);
                    addToast(`${msg.peer.username} a rejoint le salon`, 'join');
                    break;
                }
                case 'peer-left':
                    setParticipants(p => {
                        const _leaving = p.find(part => part.userId === msg.userId);
                        if (_leaving && msg.channelId !== 'global') {
                            addToast(`${_leaving.username} a quitté le salon`, 'leave');
                        }
                        return p.filter(part => part.userId !== msg.userId);
                    });
                    break;
                case 'peer-state':
                    setParticipants(p => p.map(part =>
                        part.userId === msg.userId ? { ...part, isMuted: msg.isMuted, isDeafened: msg.isDeafened } : part));
                    break;
                case 'track-map': {
                    trackToUserMapRef.current.set(msg.trackId, msg.userId);
                    trackToUserMapRef.current.set(msg.streamId, msg.userId);

                    // Resolve any orphan stream that arrived before this mapping
                    const _orphan = orphanStreamsRef.current.get(msg.trackId)
                        ?? orphanStreamsRef.current.get(msg.streamId);
                    if (_orphan) {
                        if (_orphan.kind === 'audio') {
                            setRemoteStreams(r => new Map(r).set(msg.userId, _orphan.stream));
                        } else if (_orphan.kind === 'video') {
                            setRemoteVideoStreams(r => new Map(r).set(msg.userId, _orphan.stream));
                        }
                        orphanStreamsRef.current.delete(msg.trackId);
                        orphanStreamsRef.current.delete(msg.streamId);
                    } else {
                        // Buffer the mapping for an `ontrack` that hasn't fired yet
                        pendingTrackMapsRef.current.set(msg.trackId, { userId: msg.userId, kind: msg.kind });
                        pendingTrackMapsRef.current.set(msg.streamId, { userId: msg.userId, kind: msg.kind });
                    }

                    // Migrate any state entry keyed by streamId / trackId to userId
                    setRemoteStreams(prev => {
                        const _src = prev.get(msg.streamId) ?? prev.get(msg.trackId);
                        if (!_src) return prev;
                        const _next = new Map(prev);
                        _next.set(msg.userId, _src);
                        _next.delete(msg.streamId);
                        _next.delete(msg.trackId);
                        return _next;
                    });
                    setRemoteVideoStreams(prev => {
                        const _src = prev.get(msg.streamId) ?? prev.get(msg.trackId);
                        if (!_src) return prev;
                        const _next = new Map(prev);
                        _next.set(msg.userId, _src);
                        _next.delete(msg.streamId);
                        _next.delete(msg.trackId);
                        return _next;
                    });
                    break;
                }
                case 'offer':
                    if (!sfuConnectionRef.current) connectSFU();
                    await sfuConnectionRef.current!.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                    const _answer = await sfuConnectionRef.current!.createAnswer();
                    await sfuConnectionRef.current!.setLocalDescription(_answer);
                    sendSignal({ type: 'answer', sdp: _answer } as any);
                    break;
                case 'answer':
                    if (sfuConnectionRef.current) await sfuConnectionRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                    break;
                case 'ice':
                    if (sfuConnectionRef.current && msg.candidate) await sfuConnectionRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
                    break;
                case 'chat':
                    setChatMessages(prev => {
                        const id = `${msg.from}-${msg.timestamp}`;
                        if (prev.some(m => m.id === id)) return prev;
                        return [...prev, { id, from: msg.from, username: msg.username, message: msg.message, timestamp: Number(msg.timestamp), channelId: msg.channelId }];
                    });
                    break;
                case 'stats':
                    setBandwidthStats(prev => new Map(prev).set(msg.userId, msg.bandwidthBps));
                    break;
                case 'error':
                    setError(msg.message);
                    break;
                case 'friend-request-received':
                case 'friend-request-accepted':
                case 'friend-request-declined':
                case 'friend-request-cancelled':
                case 'friend-removed':
                    // Forward social events to the signaling bus so feature
                    // contexts (e.g. FriendsContext) can react without coupling.
                    emitSignalingEvent(msg.type, msg as never);
                    break;
            }
        } catch (e) { console.error("Signal parsing error:", e); }
    }, [connectSFU, sendSignal, addToast, userIdRef, usernameRef, setParticipants, setChannelStartedAt, setRemoteStreams, setRemoteVideoStreams, setChatMessages, setBandwidthStats, setError]);

    return {
        sfuConnectionRef, screenStreamRef,
        connectSFU, handleMessage,
        addScreenTrack, removeScreenTrack,
    };
}

