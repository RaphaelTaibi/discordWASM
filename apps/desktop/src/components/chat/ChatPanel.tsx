import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../../context/ChatContext';
import { useVoiceStore } from '../../context/VoiceContext';
import { Send } from 'lucide-react';

const MAX_CHARACTERS = 300;

const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const ChatPanel = () => {
    const { chatMessages, sendChatMessage } = useChatStore();
    const { localUserId, avatarUrl: voiceAvatar } = useVoiceStore() as any; // Using any as workaround if it doesn't exist yet
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Scroll automatique
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedInput = input.trim().slice(0, MAX_CHARACTERS);
        if (trimmedInput) {
            sendChatMessage(trimmedInput);
            setInput('');
        }
    };


    return (
        <div className="flex-1 flex flex-col bg-[#050511] relative z-10 w-full h-full overflow-hidden">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar min-h-0 bg-transparent flex flex-col">
                <div className="mt-auto">
                    {chatMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-cyan-500/50 space-y-4 my-10 animate-in fade-in duration-500">
                            <div className="w-16 h-16 rounded-2xl bg-cyan-900/20 flex items-center justify-center border border-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
                                <Send className="w-8 h-8 text-cyan-500/50" />
                            </div>
                            <div className="text-center">
                                <h3 className="font-bold text-cyan-100 text-lg tracking-wide">Bienvenue dans le chat-system</h3>
                                <p className="text-sm mt-1">C'est le début de l'historique de ce salon.</p>
                            </div>
                        </div>
                    ) : (
                        chatMessages.map((message: any, i: number) => {
                            const showHeader = 
                                i === 0 || 
                                chatMessages[i - 1].from !== message.from ||
                                message.timestamp - chatMessages[i - 1].timestamp > 5 * 60 * 1000;

                            const isLocalUser = message.from === localUserId;

                            return (
                                <div key={message.id} className={`group flex gap-4 ${showHeader ? 'mt-5' : 'mt-1'}`}>
                                    {showHeader ? (
                                        <div className="relative flex-shrink-0 w-10 h-10">
                                            {(isLocalUser && voiceAvatar) ? (
                                                <img 
                                                    src={voiceAvatar} 
                                                    alt={message.username} 
                                                    className="w-10 h-10 rounded-xl object-cover border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.15)] group-hover:border-cyan-400 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all duration-300"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-900 to-[#0a0b14] flex items-center justify-center text-cyan-200 text-lg font-black border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.15)] group-hover:border-cyan-400 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all duration-300">
                                                    {message.username.slice(0, 1).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="w-10 flex-shrink-0" />
                                    )}

                                    <div className="flex-1 min-w-0">
                                        {showHeader && (
                                            <div className="flex items-baseline gap-2 mb-1">
                                                <span className={`font-bold tracking-wide truncate ${isLocalUser ? 'text-cyan-300' : 'text-cyan-100 hover:underline cursor-pointer'}`}>
                                                    {message.username}
                                                </span>
                                                <span className="text-[10px] text-cyan-500/50 font-mono">
                                                    {formatTime(message.timestamp)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="text-cyan-50/90 text-[14px] leading-relaxed break-words">
                                            {message.message}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                </div>
            </div>

            {/* Input Area */}
            <div className="p-4 pt-0 bg-transparent flex-shrink-0">
                <form onSubmit={handleSend} className="relative">
                    <div className="absolute inset-0 bg-cyan-900/20 rounded-xl blur-xl" />
                    <div className="relative flex items-center bg-[#0a0b14] border border-cyan-500/20 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(34,211,238,0.1)] focus-within:border-cyan-500 focus-within:shadow-[0_0_30px_rgba(34,211,238,0.2)] transition-all duration-300">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Envoyer un message dans #chat-system"
                            className="flex-1 bg-transparent border-none px-4 py-3.5 text-cyan-100 placeholder-cyan-500/50 text-[14px] focus:outline-none font-medium"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            className="p-3 text-cyan-500/70 hover:text-cyan-400 disabled:opacity-50 disabled:hover:text-cyan-500/70 transition-colors mr-1"
                        >
                            <Send size={18} className={input.trim() ? "animate-pulse" : ""} />
                        </button>
                    </div>
                </form>
            </div>
            
            {/* Background Effects */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
        </div>
    );
};
