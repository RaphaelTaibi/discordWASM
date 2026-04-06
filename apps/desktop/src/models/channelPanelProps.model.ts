import { ReactNode } from "react";

export default interface ChannelPanelProps {
    channelName?: string;
    isInVoice?: boolean;
    children?: ReactNode;
}

