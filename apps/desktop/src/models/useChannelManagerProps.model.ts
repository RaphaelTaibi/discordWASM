import { Dispatch, MutableRefObject, SetStateAction } from 'react';
import VoicePeer from './voicePeer.model';

export default interface UseChannelManagerProps {
  sendSignal: (payload: any) => Promise<void>;
  sfuConnectionRef: MutableRefObject<RTCPeerConnection | null>;
  localStreamRef: MutableRefObject<MediaStream | null>;
  localAudioCtxRef: MutableRefObject<AudioContext | null>;
  screenStreamRef: MutableRefObject<MediaStream | null>;
  noiseGateNodeRef: MutableRefObject<AudioWorkletNode | null>;
  channelIdRef: MutableRefObject<string | null>;
  userIdRef: MutableRefObject<string>;
  usernameRef: MutableRefObject<string>;
  fingerprintRef: MutableRefObject<string | null>;
  rawMicVolumeRef: MutableRefObject<number>;
  remoteStreams: Map<string, MediaStream>;
  smartGateEnabled: boolean;
  vadThreshold: number;
  vadAuto: boolean;
  setLocalStream: Dispatch<SetStateAction<MediaStream | null>>;
  setRawLocalStream: Dispatch<SetStateAction<MediaStream | null>>;
  setChannelId: Dispatch<SetStateAction<string | null>>;
  setParticipants: Dispatch<SetStateAction<VoicePeer[]>>;
  setChannelStartedAt: Dispatch<SetStateAction<number | undefined>>;
  setRemoteStreams: Dispatch<SetStateAction<Map<string, MediaStream>>>;
  setRemoteVideoStreams: Dispatch<SetStateAction<Map<string, MediaStream>>>;
  setError: Dispatch<SetStateAction<string | null>>;
}

