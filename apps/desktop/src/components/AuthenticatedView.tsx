import { FC, useCallback, useEffect } from "react";
import MainLayout from "./layout/MainLayout";
import { ServerSidebar } from "./sidebar/ServerSidebar";
import { ChannelList } from "./channel/ChannelList";
import UserFooter from "./sidebar/UserFooter";
import { ChatPanel } from "./chat/ChatPanel";
import { LoginView } from "./auth/LoginView";
import { SettingsModal } from "./ui/SettingsModal";
import { VoiceGrid } from "./channel/VoiceGrid";
import { useDashboardState } from "../hooks/useDashboardState";
import { useVoiceActivity } from "../hooks/useVoiceActivity";
import { useVoiceGrid } from "../hooks/useVoiceGrid";
import { useStreamStore } from "../context/StreamContext";
import { displayNameWithTag } from "../lib/identity-tag";

/**
 * Main authenticated view. Composes MainLayout with all panels.
 * Business logic comes from useDashboardState hook.
 * All hooks must be called before any conditional return.
 */
const AuthenticatedView: FC = () => {
    const {
        isAuthenticated, username, userId, login, logout, recover,
        activeServer, activeChannelId, setActiveChannelId,
        activeView, setActiveView,
        voice, createChannel, deleteChannel, deleteServer,
        isSettingsOpen, setIsSettingsOpen,
        updater, isOwner,
    } = useDashboardState();

    const speakingUsers = useVoiceActivity(
        voice.remoteStreams,
        voice.localUserId,
        voice.rawLocalStream,
        voice.isMuted,
    );

    // Use voice.channelId when available, fall back to activeChannelId for immediate display
    const _voiceChannelId = activeView === 'voice'
        ? (voice.channelId ?? activeChannelId)
        : voice.channelId;

    const { stream: screenStream, isStreaming, startCapture, stopCapture } = useStreamStore();

    const { tiles, spotlightUserId, handleSpotlight } = useVoiceGrid({
        participants: voice.participants,
        localUserId: voice.localUserId,
        localUsername: username ?? '',
        localStream: voice.localStream,
        localScreenStream: screenStream,
        remoteStreams: voice.remoteStreams,
        remoteVideoStreams: voice.remoteVideoStreams,
        speakingUsers,
        voiceAvatar: voice.voiceAvatar,
        channelId: _voiceChannelId,
        isMuted: voice.isMuted,
        isDeafened: voice.isDeafened,
    });


    /** Forward captured screen stream to the SFU peer connection */
    useEffect(() => {
        if (screenStream) voice.addScreenTrack(screenStream);
    }, [screenStream]);

    const handleToggleStream = useCallback(async () => {
        if (isStreaming) {
            voice.removeScreenTrack();
            stopCapture();
        } else {
            await startCapture();
        }
    }, [isStreaming, startCapture, stopCapture, voice]);

    if (!isAuthenticated) return <LoginView onLogin={login} onRecover={recover} />;

    const handleSelectChannel = (channelId: string) => {
        const _channel = activeServer?.channels.find(c => c.id === channelId);
        if (_channel?.type === 'text') {
            setActiveView('chat');
        } else {
            setActiveView('voice');
        }
        setActiveChannelId(channelId);
    };

    const handleJoinVoice = (channelId: string) => {
        if (username) voice.joinChannel(channelId, username);
    };

    const sidebar = (
        <div className="flex flex-col h-full w-full overflow-hidden">
            {activeServer ? (
                <ChannelList
                    server={activeServer}
                    activeChannelId={activeChannelId}
                    voiceChannelId={voice.channelId}
                    onSelectChannel={handleSelectChannel}
                    onJoinVoice={handleJoinVoice}
                    onCreateChannel={(ch) => createChannel(activeServer.id, ch)}
                    onDeleteChannel={(chId) => deleteChannel(activeServer.id, chId)}
                    onDeleteServer={() => deleteServer(activeServer.id)}
                    isOwner={isOwner}
                    participants={voice.participants}
                    speakingUsers={speakingUsers}
                />
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
            channelId={_voiceChannelId}
            isSpeaking={speakingUsers.get(voice.localUserId) ?? false}
            onStream={handleToggleStream}
            isStreaming={isStreaming}
            networkQuality={voice.networkQuality}
            ping={voice.ping}
            averagePing={voice.averagePing}
            packetLoss={voice.packetLoss}
            onOpenSettings={() => setIsSettingsOpen(true)}
            avatarUrl={voice.voiceAvatar}
        />
    );

    const _channelName = activeView === 'chat'
        ? activeServer?.channels.find(c => c.id === activeChannelId)?.name ?? 'chat'
        : activeServer?.channels.find(c => c.id === (voice.channelId ?? activeChannelId))?.name ?? 'vocal';

    return (
        <main id="bento-area" className="flex-1 relative overflow-hidden h-full z-10">
            <div className="absolute top-1 right-2 z-30">
                <ServerSidebar />
            </div>

            <MainLayout
                sidebar={sidebar}
                sidebarFooter={sidebarFooter}
                channelName={_channelName}
                isInVoice={activeView === 'voice'}
            >
                {activeView === 'chat' && <ChatPanel />}
                {activeView === 'voice' && (
                    <VoiceGrid
                        tiles={tiles}
                        spotlightUserId={spotlightUserId}
                        onSpotlight={handleSpotlight}
                        localUserId={voice.localUserId}
                    />
                )}
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

