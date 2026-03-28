import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StreamProvider, useStreamStore } from './context/StreamContext';
import { VoiceProvider, useVoiceStore } from './context/VoiceContext';
import { ToastProvider } from './context/ToastContext';
import { LoginView } from './components/auth/LoginView';
import { MainLayout } from './components/layout/MainLayout';
import { BottomActions } from './components/layout/BottomActions';
import { StreamCard } from './components/stream/StreamCard';
import { VoiceAudioRenderer } from './components/stream/VoiceAudioRenderer';
import { SidebarContent } from './components/sidebar/SidebarContent';
import { MembersPanel } from './components/sidebar/MembersPanel';
import { UserBar } from './components/sidebar/UserBar';
import { ToastContainer } from './components/ui/ToastContainer';
import { useVoiceActivity } from './hooks/useVoiceActivity';
import { Headphones } from 'lucide-react';

const Dashboard = () => {
    const { username, logout } = useAuth();
    const { stream, metrics, isStreaming, startCapture, stopCapture } = useStreamStore();
    const {
        channelId,
        participants,
        isConnected,
        isMuted,
        isDeafened,
        error,
        localUserId,
        localStream,
        joinChannel,
        leaveChannel,
        toggleMute,
        toggleDeafen,
        remoteStreams,
        remoteVideoStreams,
        addScreenTrack,
        removeScreenTrack,
    } = useVoiceStore();

    const speakingUsers = useVoiceActivity(remoteStreams, localUserId, localStream, isMuted);

    // Bridge screen share to WebRTC peer connections
    useEffect(() => {
        if (isStreaming && stream && isConnected) {
            addScreenTrack(stream);
        }
        return () => {
            if (!isStreaming) {
                removeScreenTrack();
            }
        };
    }, [isStreaming, stream, isConnected]);

    const safeUsername = username || 'Anonyme';
    const stageCards = [
        { id: localUserId, username: safeUsername, live: true },
        ...participants
            .filter((member) => member.username !== safeUsername)
            .map((member) => ({ id: member.userId, username: member.username, live: false })),
    ];

    const handleLogout = () => {
        leaveChannel();
        logout();
    };

    return (
        <MainLayout
            sidebar={
                <SidebarContent
                    channelId={channelId}
                    isConnected={isConnected}
                    isMuted={isMuted}
                    isDeafened={isDeafened}
                    error={error}
                    onJoin={(targetChannelId) => joinChannel(targetChannelId, safeUsername)}
                    onLeave={leaveChannel}
                    onToggleMute={toggleMute}
                    onToggleDeafen={toggleDeafen}
                    onLogout={handleLogout}
                />
            }
            sidebarFooter={
                <UserBar
                    username={safeUsername}
                    isConnected={isConnected}
                    isMuted={isMuted}
                    onToggleMute={toggleMute}
                    isDeafened={isDeafened}
                    onToggleDeafen={toggleDeafen}
                    channelId={channelId}
                    isSpeaking={speakingUsers.get(localUserId) ?? false}
                />
            }
            rightPanel={
                <MembersPanel
                    participants={participants}
                    isConnected={isConnected}
                    channelId={channelId}
                    speakingUsers={speakingUsers}
                />
            }
            footer={
                <BottomActions
                    metricsLum={metrics.lum}
                    metricsStatus={metrics.status}
                    isStreaming={isStreaming}
                    onToggleStream={() => {
                        if (isStreaming) {
                            removeScreenTrack();
                            stopCapture();
                        } else {
                            startCapture();
                        }
                    }}
                    isMuted={isMuted}
                    onToggleMute={toggleMute}
                    isDeafened={isDeafened}
                    onToggleDeafen={toggleDeafen}
                    channelId={channelId}
                />
            }
        >
            <div className={`grid gap-3 ${
                stageCards.length === 1 ? 'grid-cols-1' :
                stageCards.length <= 4 ? 'grid-cols-1 xl:grid-cols-2' :
                'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
            }`}>
                {stageCards.map((card) => {
                    const isSpeaking = speakingUsers.get(card.id) ?? false;

                    if (card.id === localUserId) {
                        return (
                            <div key={card.id} className="relative">
                                <StreamCard
                                    stream={stream}
                                    username={safeUsername}
                                    isBright={metrics.lum > 220}
                                    isSpeaking={isSpeaking}
                                />
                                {isDeafened && (
                                    <div
                                        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-red-500 border-2 border-[#232428] inline-flex items-center justify-center shadow-md"
                                        aria-label="Son entrant coupé"
                                        title="Son entrant coupé"
                                    >
                                        <Headphones size={13} className="text-white" />
                                    </div>
                                )}
                            </div>
                        );
                    }

                    const remoteVideo = remoteVideoStreams.get(card.id);

                    if (remoteVideo) {
                        return (
                            <div key={card.id} className="relative">
                                <StreamCard
                                    stream={remoteVideo}
                                    username={card.username}
                                    isSpeaking={isSpeaking}
                                />
                            </div>
                        );
                    }

                    return (
                        <div key={card.id} className="relative aspect-video rounded-lg overflow-hidden bg-[#1e1f22] border border-black/30 transition-all duration-300 hover:scale-[1.01]">
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className={`w-20 h-20 rounded-full bg-[#3f4147] text-white flex items-center justify-center text-2xl font-bold transition-all duration-300 ${
                                    isSpeaking ? 'ring-4 ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]' : ''
                                }`}>
                                    {card.username.slice(0, 1).toUpperCase()}
                                </div>
                            </div>
                            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                                    isSpeaking ? 'bg-green-500 animate-pulse' : card.username === 'Slot libre' ? 'bg-gray-500' : 'bg-green-500'
                                }`} />
                                <span className="text-xs font-bold text-white">{card.username}</span>
                            </div>
                        </div>
                    );
                })}

                <div className="col-span-full rounded-lg bg-[#232428] border border-black/20 p-4">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wide mb-2">Activité vocale</h3>
                    <p className="text-gray-400 text-sm mb-1">
                        {isConnected ? `Connecté au salon ${channelId}` : 'Pas encore connecté à un salon vocal'}
                    </p>
                    <p className="text-xs text-gray-500">WebRTC audio en pair-à-pair (mesh).</p>
                </div>
            </div>

            {Array.from(remoteStreams.entries()).map(([peerId, audioStream]) => (
                <VoiceAudioRenderer key={peerId} stream={audioStream} muted={isDeafened} />
            ))}
        </MainLayout>
    );
};

export default function App() {
    return (
        <AuthProvider>
            <ToastProvider>
                <VoiceProvider>
                    <StreamProvider>
                        <AppContent />
                        <ToastContainer />
                    </StreamProvider>
                </VoiceProvider>
            </ToastProvider>
        </AuthProvider>
    );
}

function AppContent() {
    const { isAuthenticated, login } = useAuth();
    return isAuthenticated ? <Dashboard /> : <LoginView onLogin={login} />;
}
