import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useServer } from "../context/ServerContext";
import { useVoiceStore } from "../context/VoiceContext";
import { useTauriUpdater } from "../lib/useTauriUpdater";
import { SidebarView } from "../types/sidebarView.type";
import { Server } from "../models/server/server.model";

/**
 * Centralizes all dashboard business logic.
 * Provides state and callbacks for the authenticated main view.
 */
export function useDashboardState() {
    // `userId` exposed by `useAuth` is the local Ed25519 public key — useful
    // for local crypto, but the signaling server keys every member by its
    // server-side UUID (`serverUserId`). Passing the pubkey to the voice
    // pipeline makes the SFU silently reject the `join` frame, leaving the
    // user alone in the channel (`sfu_active_peers=0`). Always feed the
    // server UUID to the voice context.
    const { isAuthenticated, login, logout, recover, username, userId, serverUserId } = useAuth();
    const { servers, activeServerId, createChannel, deleteChannel, deleteServer, isOwner: checkOwner } = useServer();
    const voice = useVoiceStore();
    const updater = useTauriUpdater();
    const [activeView, setActiveView] = useState<SidebarView>("chat");
    const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
    const [activeTextChannelId, setActiveTextChannelId] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        console.log('[VOICE] dashboard auth effect', {
            isAuthenticated, username, userId, serverUserId,
        });
        if (isAuthenticated && username && serverUserId) {
            console.log('[VOICE] dashboard → voice.setUserInfo with serverUserId', serverUserId);
            voice.setUserInfo(username, serverUserId);
        } else {
            console.warn('[VOICE] dashboard NOT calling setUserInfo (missing pieces)');
        }
    }, [isAuthenticated, username, serverUserId]);

    useEffect(() => {
        setActiveChannelId(null);
        setActiveTextChannelId(null);
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
        activeTextChannelId,
        setActiveTextChannelId,
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


