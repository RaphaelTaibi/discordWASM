import { createContext, ReactNode, useContext, useEffect, useState, useCallback } from 'react';
import { useVoiceStore } from './VoiceContext';
import ChatMessage from '../models/chatMessage.model';
import ChatContextValue from '../models/chatContextValue.model';

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

const STORAGE_KEY = 'chat_history_main';
const MAX_MESSAGES = 100; // Limite pour viter la saturation du localStorage

/**
 * Chat component context provider.
 * Intercepts incoming messages from the VoiceStore (Socket layer) and manages the persistent local chat history.
 * Ensures the message count does not exceed internal limits while syncing with browser LocalStorage.
 * 
 * @param {Object} props Component properties.
 * @param {ReactNode} props.children Child elements inheriting the context.
 * @returns {JSX.Element} The Provider component wrapping its children.
 */
export const ChatProvider = ({ children }: { children: ReactNode }) => {
    const { chatMessages: socketMessages, sendChatMessage: sendViaSocket } = useVoiceStore();
    const [persistedMessages, setPersistedMessages] = useState<ChatMessage[]>([]);

    // Charger l'historique au montage
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    // On garde seulement les derniers messages si l'historique est trop long
                    const sliced = parsed.slice(-MAX_MESSAGES);
                    setPersistedMessages(sliced);
                }
            } catch (e) {
                console.error("Failed to parse chat history", e);
            }
        }
    }, []);

    // Synchroniser avec les messages arrivant du VoiceStore (Socket)
    useEffect(() => {
        if (socketMessages.length === 0) return;

        setPersistedMessages(prev => {
            // Fusionner sans doublons
            const existingIds = new Set(prev.map(m => m.id));
            const newOnes = socketMessages.filter(m => !existingIds.has(m.id));
            
            if (newOnes.length === 0) return prev;

            // Garder seulement les X derniers messages
            const combined = [...prev, ...newOnes].slice(-MAX_MESSAGES);
            
            // Sauvegarde asynchrone pour ne pas bloquer le thread principal
            setTimeout(() => {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
            }, 0);

            return combined;
        });
    }, [socketMessages]);

    /**
     * Dispatch a chat message to the network through the underlying socket system.
     * 
     * @param {string} message The text content of the message to broadcast.
     */
    const sendChatMessage = useCallback((message: string) => {
        sendViaSocket(message);
    }, [sendViaSocket]);

    /**
     * Clears all recorded message history both in current memory and localStorage.
     */
    const clearHistory = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setPersistedMessages([]);
    }, []);

    return (
        <ChatContext.Provider value={{ chatMessages: persistedMessages, sendChatMessage, clearHistory }}>
            {children}
        </ChatContext.Provider>
    );
};

/**
 * Custom hook to safely grab the current Chat context, including messages and dispatch functions.
 * 
 * @throws {Error} Throws an error if invoked outside of a valid ChatProvider subtree.
 * @returns {ChatContextValue} The fully initialized chat state context values.
 */
export const useChatStore = () => {
    const context = useContext(ChatContext);
    if (!context) throw new Error('useChatStore must be used within ChatProvider');
    return context;
};
