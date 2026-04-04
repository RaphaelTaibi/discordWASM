import VoicePeer from './voicePeer.model';

export type SidebarView = 'voice' | 'chat';

export default interface SidebarContentProps {
    channelId: string | null;
    isConnected: boolean;
    isMuted: boolean;
    isDeafened: boolean;
    error: string | null;
    onJoin: (channelId: string) => void;
    onLeave: () => void;
    onToggleMute: () => void;
    onToggleDeafen: () => void;
    onLogout: () => void;
    updateCheck?: () => void;
    salons: { id: string; name: string; members: VoicePeer[] }[];
    localUserId: string;
    activeView: SidebarView;
    onViewChange: (view: SidebarView) => void;
    speakingUsers: Map<string, boolean>;
    channelStartedAt?: number;
}
