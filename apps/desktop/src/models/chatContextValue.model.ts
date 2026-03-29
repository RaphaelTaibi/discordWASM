import ChatMessage from './chatMessage.model';

export default interface ChatContextValue {
    chatMessages: ChatMessage[];
    sendChatMessage: (message: string) => void;
    clearHistory: () => void;
}
