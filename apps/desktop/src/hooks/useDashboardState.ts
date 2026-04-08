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
    const { servers, activeServerId, createChannel, deleteChannel, deleteServer, isOwner: checkOwner } = useServer();
    const voice = useVoiceStore();
    const updater = useTauriUpdater();
    const [activeView, setActiveView] = useState<SidebarView>("chat");
    const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        if (isAuthenticated && username && userId) {
            voice.setUserInfo(username, userId);
        }
    }, [isAuthenticated, username, userId]);

    useEffect(() => {
        setActiveChannelId(null);
    }, [activeServerId]);

    const activeServer: Server | undefined = activeServerId
        ? servers.find((s) => s.id === activeServerId)
        : undefined;

    const isOwner = activeServerId ? checkOwner(activeServerId) : false;

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
        createChannel,
        deleteChannel,
        deleteServer,
        isSettingsOpen,
        setIsSettingsOpen,
        updater,
        isOwner,
    };
}


