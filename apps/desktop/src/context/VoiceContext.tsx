import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ClientSignalMessage } from '../types/clientSignal.type';
import VoicePeer from '../models/voicePeer.model';
import ChatMessage from '../models/chatMessage.model';
import ExtendedVoiceState from '../models/extendedVoiceState.model';
import initWasm from '../pkg/core_wasm';
import { invoke } from '@tauri-apps/api/core';
import WebSocket from '@tauri-apps/plugin-websocket';
import { useToast } from './ToastContext';
import { useNetworkStats } from '../hooks/useNetworkStats';
import { usePushToTalk } from '../hooks/usePushToTalk';
import { useFingerprint } from '../hooks/useFingerprint';
import { useVoiceSettings } from '../hooks/useVoiceSettings';
import { useSfuConnection } from '../hooks/useSfuConnection';
import { useChannelManager } from '../hooks/useChannelManager';

const RAW_URL = import.meta.env.VITE_SIGNALING_URL || "wss://127.0.0.1:3001/ws";
const SIGNALING_URL = RAW_URL.replace(/^["']/, "").replace(/["']$/, "").trim();

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
    const [rawLocalStream, setRawLocalStream] = useState<MediaStream | null>(null);
    const [userVolumes, setUserVolumes] = useState<Map<string, number>>(new Map());
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [bandwidthStats, setBandwidthStats] = useState<Map<string, number>>(new Map());
    const [wasmReady, setWasmReady] = useState(false);
    const [localUserId, setLocalUserId] = useState<string>("");
    const [localUsername, setLocalUsername] = useState<string>("");

    const { addToast } = useToast();
    const fingerprintRef = useFingerprint(wasmReady);

    const socketRef = useRef<WebSocket | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const localAudioCtxRef = useRef<AudioContext | null>(null);
    const noiseGateNodeRef = useRef<AudioWorkletNode | null>(null);
    const userIdRef = useRef<string>("");
    const usernameRef = useRef<string>("");
    const channelIdRef = useRef<string | null>(null);
    const signalQueueRef = useRef<ClientSignalMessage[]>([]);

    // ── Extracted hooks ──────────────────────────────────────────────
    const settings = useVoiceSettings({ noiseGateNodeRef });

    const { isPttActive, enforceTrackEnabled } = usePushToTalk({
        vadMode: settings.vadMode, pttKey: settings.pttKey,
        isMuted, localStreamRef,
    });

    const sendSignal = useCallback(async (payload: ClientSignalMessage) => {
        if (socketRef.current) {
            try { await socketRef.current.send(JSON.stringify(payload)); }
            catch (err) { console.error("Signal send error:", err); }
        } else {
            signalQueueRef.current.push(payload);
        }
    }, []);

    const { sfuConnectionRef, screenStreamRef, handleMessage, addScreenTrack, removeScreenTrack } =
        useSfuConnection({
            sendSignal, localStreamRef, userIdRef, usernameRef, addToast,
            setParticipants, setChannelStartedAt, setRemoteStreams,
            setRemoteVideoStreams, setChatMessages, setBandwidthStats, setError,
        });

    const { joinChannel, leaveChannel } = useChannelManager({
        sendSignal, sfuConnectionRef, localStreamRef, localAudioCtxRef,
        screenStreamRef, noiseGateNodeRef, channelIdRef, userIdRef,
        usernameRef, fingerprintRef, rawMicVolumeRef: settings.rawMicVolumeRef,
        remoteStreams, smartGateEnabled: settings.smartGateEnabled,
        vadThreshold: settings.vadThreshold, vadAuto: settings.vadAuto,
        setLocalStream, setRawLocalStream, setChannelId, setParticipants,
        setChannelStartedAt, setRemoteStreams, setRemoteVideoStreams, setError,
    });

    // ── Refs sync ────────────────────────────────────────────────────
    useEffect(() => { userIdRef.current = localUserId; }, [localUserId]);
    useEffect(() => { usernameRef.current = localUsername; }, [localUsername]);

    // ── Socket connection ────────────────────────────────────────────
    const connectSocket = useCallback(async () => {
        if (!userIdRef.current || socketRef.current) return;
        try {
            const _checkUrl = SIGNALING_URL
                .replace(/^wss?:\/\//, (m: string) => m === 'wss://' ? 'https://' : 'http://')
                .replace(/\/ws$/, '/health');
            await invoke('call_signaling', { url: _checkUrl });

            const socket = await WebSocket.connect(SIGNALING_URL);
            socketRef.current = socket;
            setIsConnected(true);

            await socket.addListener((msg) => {
                if (msg.type === 'Text') handleMessage(msg.data);
            });

            const _initialJoin: ClientSignalMessage = {
                type: 'join',
                channelId: channelIdRef.current || 'global',
                userId: userIdRef.current,
                username: usernameRef.current,
                ...(fingerprintRef.current ? { fingerprint: fingerprintRef.current } : {}),
            };
            await socket.send(JSON.stringify(_initialJoin));

            while (signalQueueRef.current.length > 0) {
                const _signal = signalQueueRef.current.shift();
                if (_signal) await socket.send(JSON.stringify(_signal));
            }
        } catch (err) {
            console.error("Connection/pinning failure:", err);
            setIsConnected(false);
            socketRef.current = null;
            setTimeout(connectSocket, 5000);
        }
    }, [handleMessage, fingerprintRef]);

    const setUserInfo = useCallback((username: string, userId: string) => {
        if (!username || !userId) return;
        setLocalUsername(username);
        setLocalUserId(userId);
        usernameRef.current = username;
        userIdRef.current = userId;
        connectSocket();
    }, [connectSocket]);

    // ── Media toggles ────────────────────────────────────────────────
    const toggleMute = useCallback(() => {
        const next = !isMuted;
        setIsMuted(next);
        enforceTrackEnabled();
        setParticipants(p => p.map(part => part.userId === userIdRef.current ? { ...part, isMuted: next } : part));
        if (channelIdRef.current) {
            sendSignal({ type: 'media-state', channelId: channelIdRef.current, userId: userIdRef.current, isMuted: next, isDeafened });
        }
    }, [isMuted, isDeafened, sendSignal, enforceTrackEnabled]);

    const toggleDeafen = useCallback(() => {
        const next = !isDeafened;
        const nextMute = next || isMuted;
        setIsDeafened(next);
        enforceTrackEnabled();
        setParticipants(p => p.map(part => part.userId === userIdRef.current ? { ...part, isDeafened: next, isMuted: nextMute } : part));
        if (channelIdRef.current) {
            sendSignal({ type: 'media-state', channelId: channelIdRef.current, userId: userIdRef.current, isMuted: nextMute, isDeafened: next });
        }
    }, [isDeafened, isMuted, sendSignal, enforceTrackEnabled]);

    const sendChatMessage = useCallback((message: string) => {
        if (!message.trim()) return;
        sendSignal({
            type: 'chat', channelId: 'global-chat',
            from: userIdRef.current, username: usernameRef.current,
            message, timestamp: Date.now(),
        });
    }, [sendSignal]);

    // ── Init & cleanup ───────────────────────────────────────────────
    useEffect(() => {
        initWasm().then(() => setWasmReady(true)).catch(() => setWasmReady(true));
        return () => { if (socketRef.current) socketRef.current.disconnect(); };
    }, []);

    const { networkQuality, ping, averagePing, packetLoss } = useNetworkStats({
        pc: sfuConnectionRef.current, isConnected, wasmReady,
    });

    // ── Context value ────────────────────────────────────────────────
    const value = useMemo(() => ({
        channelId, participants, isConnected, isMuted, isDeafened, error,
        localUserId: userIdRef.current, localStream, rawLocalStream, channelStartedAt, bandwidthStats,
        joinChannel, leaveChannel, toggleMute, toggleDeafen,
        remoteStreams, remoteVideoStreams, addScreenTrack, removeScreenTrack,
        userVolumes, setUserVolume: (id: string, vol: number) => setUserVolumes(p => new Map(p).set(id, vol)),
        networkQuality, ping, averagePing, packetLoss,
        chatMessages, sendChatMessage, setUserInfo,
        ...settings, isPttActive,
    }), [
        channelId, participants, isConnected, isMuted, isDeafened, error,
        localUserId, localStream, rawLocalStream, channelStartedAt, bandwidthStats,
        joinChannel, leaveChannel, toggleMute, toggleDeafen,
        remoteStreams, remoteVideoStreams, addScreenTrack, removeScreenTrack,
        userVolumes, networkQuality, ping, averagePing, packetLoss,
        chatMessages, sendChatMessage, setUserInfo, settings, isPttActive,
    ]);

    return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
};

export const useVoiceStore = () => {
    const ctx = useContext(VoiceContext);
    if (!ctx) throw new Error("useVoiceStore must be used within VoiceProvider");
    return ctx;
};
