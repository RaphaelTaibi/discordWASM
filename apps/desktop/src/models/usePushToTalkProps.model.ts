import React from 'react';

export default interface UsePushToTalkProps {
  vadMode: 'VAD' | 'PTT';
  pttKey: string;
  isMuted: boolean;
  localStreamRef: React.MutableRefObject<MediaStream | null>;
}

