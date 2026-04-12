import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../../context/ChatContext';
import { useVoiceStore } from '../../context/VoiceContext';
import { Send, X } from 'lucide-react';
import { useBentoLayout } from "../../hooks/useBentoLayout";
import { useBentoDrag } from "../../hooks/useBentoDrag";
import { useBentoResize } from "../../hooks/useBentoResize";
import ResizeHandle from "../layout/ResizeHandle";
import ChatPanelProps from "../../models/chat/chatPanelProps.model";
import { ChatMessageList } from "./ChatMessageList";

const MAX_CHARACTERS = 300;

export const ChatPanel = ({ channelName, onClose }: ChatPanelProps) => {
    const { chatMessages, sendChatMessage } = useChatStore();
    const { localUserId, voiceAvatar } = useVoiceStore();
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const { x, y, w, h, onMove, onResize } = useBentoLayout("chat-panel");
    const handleDragStart = useBentoDrag(onMove);
    const handleResizeStart = useBentoResize(onResize, "corner");

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
        <div
            className="absolute z-30"
            style={{ left: x, top: y, width: w, height: h, overflow: 'visible' }}
        >
            <div className="relative w-full h-full glass-heavy rounded-2xl border border-white/6 overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col">
                {/* Drag handle */}
                <div
                    onMouseDown={handleDragStart}
                    className="h-6 cursor-grab active:cursor-grabbing flex items-center justify-center hover:bg-white/4 transition-colors shrink-0"
                >
                    <div className="w-12 h-1.5 rounded-full bg-cyan-400/20" />
                </div>

                {/* Header */}
                <header className="h-12 flex items-center px-6 border-b border-white/6 shadow-[0_4px_24px_rgba(0,0,0,0.3)] glass shrink-0 relative z-20">
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-cyan-500/10 to-transparent" />
                    <span className="text-cyan-400/50 mr-3 font-mono font-bold text-lg">#</span>
                    <h1 className="font-bold text-cyan-100/80 text-[13px] uppercase tracking-wider flex-1 truncate">
                        {channelName}
                    </h1>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-white/8 rounded-lg text-cyan-500/50 hover:text-cyan-300 transition-all cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                </header>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar min-h-0 flex flex-col bg-[#050511]/40">
                    <div className="mt-auto">
                        <ChatMessageList
                            messages={chatMessages}
                            localUserId={localUserId}
                            voiceAvatar={voiceAvatar}
                        />
                        <div ref={messagesEndRef} className="h-4" />
                    </div>
                </div>

                {/* Input */}
                <div className="p-4 pt-0 shrink-0">
                    <form onSubmit={handleSend} className="relative">
                        <div className="absolute inset-0 bg-cyan-900/20 rounded-xl blur-xl" />
                        <div className="relative flex items-center glass-heavy border border-cyan-500/20 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(34,211,238,0.1)] focus-within:border-cyan-500 focus-within:shadow-[0_0_30px_rgba(34,211,238,0.2)] transition-all duration-300">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={`Envoyer un message dans #${channelName}`}
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

                {/* Ambient glow */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
            </div>
            <ResizeHandle onMouseDown={handleResizeStart} />
        </div>
    );
};
