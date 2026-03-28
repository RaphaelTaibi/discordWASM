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
}

