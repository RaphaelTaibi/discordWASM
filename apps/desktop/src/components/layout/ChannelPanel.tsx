/**
 * ChannelPanel displays the main content area for the current voice channel.
 * Drag/resize driven by Tauri/Rust via useBentoLayout.
 */
import React from "react";
import { useBentoLayout } from "../../hooks/useBentoLayout";
import { useBentoDrag } from "../../hooks/useBentoDrag";
import { useBentoResize } from "../../hooks/useBentoResize";
import ResizeHandle from "./ResizeHandle";
import ChannelPanelProps from "../../models/channel/channelPanelProps.model";

const ChannelPanel: React.FC<ChannelPanelProps> = ({ channelName, isInVoice = false, children }) => {
    const { x, y, w, h, onMove, onResize } = useBentoLayout("channel-panel");
    const handleDragStart = useBentoDrag(onMove);
    const handleResizeStart = useBentoResize(onResize, "corner");

    if (!isInVoice) return null;

    return (
        <div
            className="absolute z-10 glass-heavy rounded-2xl overflow-hidden border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
            style={{ left: x, top: y, width: w, height: h, overflow: "visible" }}
        >
            <main className="flex flex-col h-full min-w-0 relative">
                {/* Drag handle */}
                <div
                    onMouseDown={handleDragStart}
                    className="h-6 cursor-grab active:cursor-grabbing flex items-center justify-center hover:bg-white/[0.08] transition-colors select-none"
                >
                    <div className="w-12 h-1.5 rounded-full bg-cyan-400/20" />
                </div>

                <header className="h-[48px] flex items-center px-6 border-b border-white/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.3)] glass shrink-0 relative z-20">
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent" />
                    <span className="text-cyan-400/50 mr-3 font-mono font-bold text-lg">#</span>
                    <h1 className="font-bold text-cyan-100/80 text-[13px] uppercase tracking-wider">
                        {channelName || 'vocal-general'}
                    </h1>
                </header>

                <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
                    {children}
                </div>

                <ResizeHandle onMouseDown={handleResizeStart} />
            </main>
        </div>
    );
};

export default ChannelPanel;

