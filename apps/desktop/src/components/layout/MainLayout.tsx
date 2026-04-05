import Props from "../../models/props.model.ts";
import { ServerSidebar } from "../sidebar/ServerSidebar";

export const MainLayout = ({ sidebar, children, sidebarFooter, channelName }: Props & { channelName?: string }) => {
    return (
        <div className="flex h-screen w-full bg-[#050511] text-gray-200 select-none overflow-hidden font-sans relative">
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/10 via-[#050511]/80 to-[#050511] z-0" />
            
            {/* Barre des serveurs (Icons) */}
            <div className="z-10 flex shrink-0 h-full">
                <ServerSidebar />
            </div>

            {/* Sidebar des Salons + UserBar en bas */}
            <aside className="w-60 bg-[#0a0b14]/90 backdrop-blur-md flex flex-col border-r border-cyan-500/10 min-h-0 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.4)] relative">
                <div className="absolute top-0 bottom-0 right-0 w-px bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent" />
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
                    {sidebar}
                </div>
                {sidebarFooter && (
                    <div className="flex-shrink-0 bg-[#06070d]/80 border-t border-cyan-500/10">
                        {sidebarFooter}
                    </div>
                )}
            </aside>

            {/* Zone Principale */}
            <main className="flex-1 flex flex-col bg-[#050511]/60 backdrop-blur-sm min-w-0 z-10 relative">
                {/* Header/Top Bar */}
                <header className="h-[60px] flex items-center px-6 border-b border-cyan-500/10 shadow-[0_4px_24px_rgba(0,0,0,0.2)] bg-[#0a0b14]/80 flex-shrink-0 relative z-20">
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
                    <span className="text-cyan-400/70 mr-3 font-mono font-bold text-xl">#</span>
                    <h1 className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-50 to-cyan-200 text-[14px] uppercase tracking-wider">
                        {channelName || 'vocal-general'}
                    </h1>
                </header>

                <div className="flex-1 min-h-0 relative flex flex-col items-center justify-center">
                    {children}
                </div>
            </main>
        </div>
    );
};
