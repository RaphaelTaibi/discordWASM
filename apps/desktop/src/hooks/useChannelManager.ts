import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import UseChannelManagerProps from '../models/voice/useChannelManagerProps.model';

/**
 * Encapsulates join / leave channel logic including
 * microphone acquisition, noise-gate worklet wiring and cleanup.
 */
export function useChannelManager({
    sendSignal, sfuConnectionRef, localStreamRef, localAudioCtxRef,
    screenStreamRef, noiseGateNodeRef, channelIdRef, userIdRef,
    usernameRef, fingerprintRef, rawMicVolumeRef, remoteStreams,
    smartGateEnabled, vadThreshold, vadAuto,
    setLocalStream, setRawLocalStream, setChannelId, setParticipants,
    setChannelStartedAt, setRemoteStreams, setRemoteVideoStreams, setError,
}: UseChannelManagerProps) {

    const joinChannel = useCallback(async (nextChannelId: string, username: string) => {
        console.log('[VOICE] joinChannel called', {
            nextChannelId,
            username,
            currentChannel: channelIdRef.current,
            userId: userIdRef.current,
        });
        if (!nextChannelId || nextChannelId === channelIdRef.current) {
            console.warn('[VOICE] joinChannel SKIP (empty or same channel)');
            return;
        }
        const _prevChannel = channelIdRef.current || 'global';
        sendSignal({ type: 'leave', channelId: _prevChannel, userId: userIdRef.current });

        try {
            console.log('[VOICE] joinChannel acquiring microphone…');
            const _selectedMicId = localStorage.getItem('selectedMic');
            const _webrtcNoiseSuppression = localStorage.getItem('webrtcNoiseSuppression') !== 'false';
            const audioConstraints: MediaTrackConstraints = {
                echoCancellation: true,
                noiseSuppression: _webrtcNoiseSuppression,
                autoGainControl: true,
            };
            if (_selectedMicId) audioConstraints.deviceId = { exact: _selectedMicId };

            const _rawStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
            console.log('[VOICE] joinChannel mic acquired, tracks:', _rawStream.getAudioTracks().length);
            const audioCtx = new window.AudioContext();
            const source = audioCtx.createMediaStreamSource(_rawStream);
            const destination = audioCtx.createMediaStreamDestination();

            await audioCtx.audioWorklet.addModule('/worker/noise-gate.worklet.js');
            const _gateNode = new AudioWorkletNode(audioCtx, 'noise-gate-processor');
            noiseGateNodeRef.current = _gateNode;

            const wasmRes = await fetch('/pkg/core_wasm_bg.wasm');
            const wasmBuffer = await wasmRes.arrayBuffer();

            let rtSeal: number | null = null;
            try { rtSeal = await invoke<number>('get_dsp_token'); } catch { /* web context */ }

            _gateNode.port.onmessage = (event) => {
                if (event.data.type === 'volume') rawMicVolumeRef.current = event.data.volume;
            };

            const db = (vadThreshold * 100) - 100;
            const activeDb = vadAuto ? -80 : db;
            const linearThreshold = Math.pow(10, activeDb / 20);

            _gateNode.port.postMessage({
                type: 'INIT_WASM', wasmBuffer, rtSeal,
                threshold: linearThreshold, attack: 0.01, release: 0.1, autoMode: vadAuto,
            });

            if (smartGateEnabled) {
                source.connect(_gateNode);
                _gateNode.connect(destination);
            } else {
                source.connect(destination);
            }

            const _gateStream = destination.stream;
            localAudioCtxRef.current = audioCtx;
            localStreamRef.current = _gateStream;
            setLocalStream(_gateStream);
            setRawLocalStream(_rawStream);
            channelIdRef.current = nextChannelId;
            setChannelId(nextChannelId);
            const _joinPayload = {
                type: 'join' as const,
                channelId: nextChannelId,
                userId: userIdRef.current,
                username,
                ...(fingerprintRef.current ? { fingerprint: fingerprintRef.current } : {}),
            };
            console.log('[VOICE] joinChannel sending join →', _joinPayload);
            sendSignal(_joinPayload);
        } catch (err) {
            console.error('[VOICE] joinChannel FAILED:', err);
            setError("Microphone inaccessible");
        }
    }, [sendSignal, smartGateEnabled, vadThreshold, vadAuto, channelIdRef, userIdRef, fingerprintRef, noiseGateNodeRef, rawMicVolumeRef, localStreamRef, localAudioCtxRef, setLocalStream, setRawLocalStream, setChannelId, setError]);

    const leaveChannel = useCallback(() => {
        if (channelIdRef.current) {
            sendSignal({ type: 'leave', channelId: channelIdRef.current, userId: userIdRef.current });
            sendSignal({
                type: 'join', channelId: 'global', userId: userIdRef.current, username: usernameRef.current,
                ...(fingerprintRef.current ? { fingerprint: fingerprintRef.current } : {}),
            });
        }
        if (sfuConnectionRef.current) { sfuConnectionRef.current.close(); sfuConnectionRef.current = null; }
        if (localAudioCtxRef.current) { localAudioCtxRef.current.close(); localAudioCtxRef.current = null; }
        noiseGateNodeRef.current = null;
        if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
        setRawLocalStream(null);
        if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        setChannelId(null);
        channelIdRef.current = null;
        setParticipants([]);
        setChannelStartedAt(undefined);
        remoteStreams.forEach(stream => stream.getTracks().forEach(t => t.stop()));
        setRemoteStreams(new Map());
        setRemoteVideoStreams(new Map());
    }, [sendSignal, sfuConnectionRef, localStreamRef, localAudioCtxRef, screenStreamRef, noiseGateNodeRef, channelIdRef, userIdRef, usernameRef, fingerprintRef, remoteStreams, setLocalStream, setRawLocalStream, setChannelId, setParticipants, setChannelStartedAt, setRemoteStreams, setRemoteVideoStreams]);

    return { joinChannel, leaveChannel };
}

