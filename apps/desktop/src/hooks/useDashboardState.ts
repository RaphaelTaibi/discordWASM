import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useServer } from "../context/ServerContext";
import { useVoiceStore } from "../context/VoiceContext";
import { useTauriUpdater } from "../lib/useTauriUpdater";
import { SidebarView } from "../models/sidebarContentProps.model";
import { Server } from "../models/server.model";

/**
 * Centralizes all dashboard business logic.
 * Provides state and callbacks for the authenticated main view.
 */
export function useDashboardState() {
    const { isAuthenticated, login, logout, recover, username, userId } = useAuth();
    const { servers, activeServerId, createChannel, deleteChannel } = useServer();
    const voice = useVoiceStore();
    const updater = useTauriUpdater();
    const [activeView, setActiveView] = useState<SidebarView>("chat");
    const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Bridge auth identity into the voice/signaling layer
    useEffect(() => {
        if (isAuthenticated && username && userId) {
            voice.setUserInfo(username, userId);
        }
    }, [isAuthenticated, username, userId]);

    // Reset selected channel when switching servers
    useEffect(() => {
        setActiveChannelId(null);
    }, [activeServerId]);

    const activeServer: Server | undefined = activeServerId
        ? servers.find((s) => s.id === activeServerId)
        : undefined;

    const salons = activeServer
        ? activeServer.channels
              .filter((c) => c.type === "voice" || c.type === "video")
              .map((c) => ({
                  id: c.id,
                  name: c.name,
                  members: voice.participants.filter(
                      () => voice.channelId === c.id
                  ),
              }))
        : [];

    return {
        isAuthenticated,
        username,
        userId,
        login,
        logout,
        recover,
        activeServer,
        activeChannelId,
        setActiveChannelId,
        activeView,
        setActiveView,
        voice,
        salons,
        createChannel,
        deleteChannel,
        isSettingsOpen,
        setIsSettingsOpen,
        updater,
    };
}


