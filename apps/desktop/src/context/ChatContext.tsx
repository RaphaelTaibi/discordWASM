import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useVoiceStore } from './VoiceContext';
import { useServer } from './ServerContext';
import ChatContextValue from '../models/chat/chatContextValue.model';
import ChatMessage from '../models/chat/chatMessage.model';
import { fetchChannelMessages } from '../api/server.api';

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

/**
 * Channel-aware chat context. Loads history from the server when
 * the active text channel changes and forwards WebSocket messages.
 */
export const ChatProvider = ({ children }: { children: ReactNode }) => {
    const { chatMessages: wsChatMessages, sendChatMessage: wsSend, clearChatMessages } = useVoiceStore();
    const { activeServerId } = useServer();
    const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
    const [historyMessages, setHistoryMessages] = useState<ChatMessage[]>([]);
    const _prevChannelRef = useRef<string | null>(null);

    /** Fetches persisted chat history from the signaling server. */
    const loadHistory = useCallback(async (serverId: string, channelId: string) => {
        try {
            const _messages = await fetchChannelMessages(serverId, channelId);
            setHistoryMessages(_messages);
        } catch {
            setHistoryMessages([]);
        }
    }, []);

    // Reload history when active channel or server changes
    useEffect(() => {
        if (activeChannelId && activeServerId && activeChannelId !== _prevChannelRef.current) {
            clearChatMessages();
            loadHistory(activeServerId, activeChannelId);
        }
        if (!activeChannelId) {
            setHistoryMessages([]);
        }
        _prevChannelRef.current = activeChannelId;
    }, [activeChannelId, activeServerId, loadHistory, clearChatMessages]);

    // Lightweight live-refresh: while a text channel is active, re-fetch its
    // history every 5s + on window focus. The signaling WS only broadcasts
    // chat to voice-channel members, so text channels would otherwise feel
    // REST-only. Replace this with a `chat.message` WS event when available.
    useEffect(() => {
        if (!activeChannelId || !activeServerId) return;
        const _tick = () => loadHistory(activeServerId, activeChannelId);
        const _interval = setInterval(_tick, 5_000);
        const _onFocus = () => _tick();
        window.addEventListener('focus', _onFocus);
        return () => {
            clearInterval(_interval);
            window.removeEventListener('focus', _onFocus);
        };
    }, [activeChannelId, activeServerId, loadHistory]);

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
