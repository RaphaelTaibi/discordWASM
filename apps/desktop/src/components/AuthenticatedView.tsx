import { FC } from "react";
import MainLayout from "./layout/MainLayout";
import { ServerSidebar } from "./sidebar/ServerSidebar";
import { ChannelList } from "./channel/ChannelList";
import { SidebarContent } from "./sidebar/SidebarContent";
import UserFooter from "./sidebar/UserFooter";
import { ChatPanel } from "./chat/ChatPanel";
import { LoginView } from "./auth/LoginView";
import { SettingsModal } from "./ui/SettingsModal";
import { useDashboardState } from "../hooks/useDashboardState";
import { SidebarView } from "../models/sidebarContentProps.model";
import { displayNameWithTag } from "../lib/identity-tag";

/**
 * Main authenticated view. Composes MainLayout with all panels.
 * Business logic comes from useDashboardState hook.
 */
const AuthenticatedView: FC = () => {
    const {
        isAuthenticated, username, userId, login, logout, recover,
        activeServer, activeChannelId, setActiveChannelId,
        activeView, setActiveView,
        voice, salons,
        createChannel, deleteChannel,
        isSettingsOpen, setIsSettingsOpen,
        updater,
    } = useDashboardState();

    if (!isAuthenticated) return <LoginView onLogin={login} onRecover={recover} />;

    const sidebar = (
        <div className="flex flex-col h-full w-full overflow-hidden">
            {activeServer ? (
                <>
                    <ChannelList
                        server={activeServer}
                        activeChannelId={activeChannelId}
                        onSelectChannel={(id) => setActiveChannelId(id)}
                        onCreateChannel={(ch) => createChannel(activeServer.id, ch)}
                        onDeleteChannel={(chId) => deleteChannel(activeServer.id, chId)}
                        isOwner={true}
                    />
                    <SidebarContent
                        activeView={activeView}
                        onViewChange={(v: SidebarView) => setActiveView(v)}
                        channelId={voice.channelId}
                        isConnected={voice.isConnected}
                        isMuted={voice.isMuted}
                        isDeafened={voice.isDeafened}
                        error={voice.error}
                        onJoin={(id) => voice.joinChannel(id, voice.localUserId)}
                        onLeave={voice.leaveChannel}
                        onToggleMute={voice.toggleMute}
                        onToggleDeafen={voice.toggleDeafen}
                        onLogout={logout}
                        salons={salons}
                        localUserId={voice.localUserId}
                        speakingUsers={new Map(voice.participants.map(p => [p.userId, false]))}
                        channelStartedAt={voice.channelStartedAt}
                    />
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
                    <div className="w-14 h-14 rounded-2xl glass-heavy flex items-center justify-center border border-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.1)]">
                        <span className="text-2xl font-black text-cyan-400/60">V</span>
                    </div>
                    <p className="text-cyan-100/40 text-sm font-medium leading-relaxed">
                        Créez ou sélectionnez un serveur pour commencer.
                    </p>
                </div>
            )}
        </div>
    );

    const sidebarFooter = (
        <UserFooter
            onLogout={logout}
            onLeave={voice.leaveChannel}
            username={username && userId ? displayNameWithTag(username, userId) : "Utilisateur"}
            isConnected={voice.isConnected}
            isMuted={voice.isMuted}
            onToggleMute={voice.toggleMute}
            isDeafened={voice.isDeafened}
            onToggleDeafen={voice.toggleDeafen}
            channelId={voice.channelId}
            networkQuality={voice.networkQuality}
            ping={voice.ping}
            averagePing={voice.averagePing}
            packetLoss={voice.packetLoss}
            onOpenSettings={() => setIsSettingsOpen(true)}
        />
    );

    return (
        <main id="bento-area" className="flex-1 relative overflow-hidden h-full z-10">
            {/* Server bar floating top-right */}
            <div className="absolute top-1 right-2 z-30">
                <ServerSidebar />
            </div>

            <MainLayout
                sidebar={sidebar}
                sidebarFooter={sidebarFooter}
                channelName={activeView === 'chat' ? 'chat-system' : 'vocal-general'}
                isInVoice={activeView === 'voice'}
            >
                {activeView === 'chat' && <ChatPanel />}
            </MainLayout>

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                updateAvailable={updater.updateAvailable}
                updateStatus={updater.updateStatus}
                triggerUpdate={updater.triggerUpdate}
                checkForUpdate={updater.checkForUpdate}
            />
        </main>
    );
};

export default AuthenticatedView;

