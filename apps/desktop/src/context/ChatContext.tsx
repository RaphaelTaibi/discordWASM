import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useVoiceStore } from './VoiceContext';
import { useServer } from './ServerContext';
import ChatContextValue from '../models/chat/chatContextValue.model';
import ChatMessage from '../models/chat/chatMessage.model';
import { fetchChannelMessages } from '../api/server.ws';
import { subscribeChannel, unsubscribeChannel } from '../lib/signalingTransport';
import { subscribeSignalingEvent } from '../lib/signalingBus';

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

/**
 * Channel-aware chat context. Loads history from the server when the active
 * text channel changes, subscribes the WS to push events for that channel,
 * and merges live messages without polling.
 */
export const ChatProvider = ({ children }: { children: ReactNode }) => {
    const { chatMessages: wsChatMessages, sendChatMessage: wsSend, clearChatMessages } = useVoiceStore();
    const { activeServerId } = useServer();
    const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
    const [historyMessages, setHistoryMessages] = useState<ChatMessage[]>([]);
    const _prevChannelRef = useRef<string | null>(null);

    /** One-shot fetch of persisted chat history (replaces 5s REST polling). */
    const loadHistory = useCallback(async (_serverId: string, channelId: string) => {
        try {
            const _messages = await fetchChannelMessages(channelId);
            setHistoryMessages(_messages);
        } catch {
            setHistoryMessages([]);
        }
    }, []);

    // Reload history + (re)subscribe when active channel or server changes
    useEffect(() => {
        if (activeChannelId && activeServerId && activeChannelId !== _prevChannelRef.current) {
            clearChatMessages();
            loadHistory(activeServerId, activeChannelId);

            // Subscribe to push events for this channel; release the previous one.
            if (_prevChannelRef.current) unsubscribeChannel(_prevChannelRef.current).catch(() => {});
            subscribeChannel(activeChannelId).catch(() => {});
        }
        if (!activeChannelId) {
            setHistoryMessages([]);
            if (_prevChannelRef.current) {
                unsubscribeChannel(_prevChannelRef.current).catch(() => {});
            }
        }
        _prevChannelRef.current = activeChannelId;
    }, [activeChannelId, activeServerId, loadHistory, clearChatMessages]);

    // Append every push-event chat message belonging to the active channel.
    useEffect(() => {
        return subscribeSignalingEvent('chat', (msg) => {
            if (msg.channelId !== activeChannelId) return;
            setHistoryMessages((prev) =>
                prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
            );
        });
    }, [activeChannelId]);

    // Reset on server switch
    useEffect(() => {
        setActiveChannelId(null);
        setHistoryMessages([]);
        clearChatMessages();
    }, [activeServerId, clearChatMessages]);

    // Merge history + live WS messages for the active channel, dedupe by id
    const chatMessages = (() => {
        const _map = new Map<string, ChatMessage>();
        for (const m of historyMessages) _map.set(m.id, m);
        for (const m of wsChatMessages) {
            if (m.channelId === activeChannelId) _map.set(m.id, m);
        }
        return Array.from(_map.values()).sort((a, b) => a.timestamp - b.timestamp);
    })();

    /** Sends a message to the currently active text channel. */
    const sendChatMessage = useCallback((message: string) => {
        if (!activeChannelId) return;
        wsSend(message, activeChannelId);
    }, [activeChannelId, wsSend]);

    return (
        <ChatContext.Provider value={{
            chatMessages,
            sendChatMessage,
            clearHistory: clearChatMessages,
            loadHistory,
            activeChannelId,
            setActiveChannelId,
        }}>
            {children}
        </ChatContext.Provider>
    );
};

/**
 * @throws {Error} Throws if invoked outside of a valid ChatProvider subtree.
 * @returns {ChatContextValue} Chat state and dispatch functions.
 */
export const useChatStore = () => {
    const context = useContext(ChatContext);
    if (!context) throw new Error('useChatStore must be used within ChatProvider');
    return context;
};
