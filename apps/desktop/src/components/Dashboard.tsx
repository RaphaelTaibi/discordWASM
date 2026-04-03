import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStreamStore } from '../context/StreamContext';
import { useVoiceStore } from '../context/VoiceContext';
import { MainLayout } from './layout/MainLayout';
import { StreamCard } from './stream/StreamCard';
import { VoiceAudioRenderer } from './stream/VoiceAudioRenderer';
import { SidebarContent } from './sidebar/SidebarContent';
import UserFooter from './sidebar/UserFooter';
import { useVoiceActivity } from '../hooks/useVoiceActivity';
import { Headphones } from 'lucide-react';
import { useTauriUpdater } from '../lib/useTauriUpdater';
import { SidebarView } from '../models/sidebarContentProps.model';
import { ChatPanel } from './chat/ChatPanel';
import { UserContextMenu } from './ui/UserContextMenu';

/**
 * Main application dashboard integrating voice, text chat, and stream viewing.
 * Acts as a hub for rendering the Sidebar layout and its nested panels depending on
 * the active selected view (voice vs chat). Manges context menus and global layouts.
 * 
 * @returns {JSX.Element} The fully composed dashboard view component.
 */
const Dashboard = () => {
    const { username, userId, logout } = useAuth();
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
        networkQuality,
        ping,
        setUserInfo,
        userVolumes,
        setUserVolume
    } = useVoiceStore();

    const [activeView, setActiveView] = useState<SidebarView>('voice');
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, userId: string, username: string } | null>(null);
    
    // Synchroniser les infos utilisateur avec le VoiceStore dès l'arrivée sur le Dashboard
    useEffect(() => {
        if (username && userId) {
            setUserInfo(username, userId);
        }
    }, [username, userId, setUserInfo]);

    // Memoization des remoteStreams pour éviter les cycles de re-rendu infinis dans useVoiceActivity
    const memoizedRemoteStreams = useMemo(() => new Map(remoteStreams), [remoteStreams]);
    const speakingUsers = useVoiceActivity(memoizedRemoteStreams, localUserId, localStream, isMuted);
    
    const { updateAvailable, updateStatus, triggerUpdate, checkForUpdate } = useTauriUpdater();

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

    /**
     * Handles opening the context menu for arbitrary connected users on right click.
     * Prevents the default browser context menu and overrides it with a custom component coordinates.
     * 
     * @param {React.MouseEvent} e The related right-click pointer event.
     * @param {string} userId The target network user's ID.
     * @param {string} username The target network user's name.
     */
    const handleContextMenu = (e: React.MouseEvent, userId: string, username: string) => {
        if (userId === localUserId) return;
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            userId,
            username
        });
    };

    const safeUsername = username || 'Anonyme';
    const stageCards = [
        { id: localUserId, username: safeUsername, live: true },
        ...participants
            .filter((member) => member.userId !== localUserId)
            .map((member) => ({ id: member.userId, username: member.username, live: false })),
    ];

    const salons = [
        {
            id: 'general',
            name: 'General',
            members: channelId === 'general' ? participants : [],
        },
        {
            id: 'sos',
            name: 'SOS',
            members: channelId === 'sos' ? participants : [],
        },
    ];

    /**
     * Executes the process to sever the network connections and clear current local user sessions.
     */
    const handleLogout = () => {
        leaveChannel();
        logout();
    };

    /**
     * Starts or stops screen/stream capture depending on the current state.
     */
    const handleStreamToggle = () => {
        if (isStreaming) {
            stopCapture();
        } else {
            startCapture();
        }
    };

    const channelName = activeView === 'chat' ? 'chat-general' : (salons.find(s => s.id === channelId)?.name || 'vocal-general');

    return (
        <MainLayout
            channelName={channelName}
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
                    updateCheck={checkForUpdate}
                    salons={salons}
                    localUserId={localUserId}
                    activeView={activeView}
                    onViewChange={setActiveView}
                />
            }
            sidebarFooter={
                <UserFooter
                    username={safeUsername}
                    isConnected={isConnected}
                    isMuted={isMuted}
                    onToggleMute={toggleMute}
                    isDeafened={isDeafened}
                    onToggleDeafen={toggleDeafen}
                    channelId={channelId}
                    isSpeaking={speakingUsers.get(localUserId) ?? false}
                    onLeave={leaveChannel}
                    onLogout={handleLogout}
                    onStream={handleStreamToggle}
                    isStreaming={isStreaming}
                    networkQuality={networkQuality as 0 | 1 | 2 | 3}
                    ping={ping}
                    updateCheck={checkForUpdate}
                />
            }
        >
            {activeView === 'chat' ? (
                <ChatPanel />
            ) : (
                <div className={`grid gap-3 ${
                    stageCards.length === 1 ? 'grid-cols-1' :
                    stageCards.length <= 4 ? 'grid-cols-1 xl:grid-cols-2' :
                    'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                }`}>
                    {stageCards.map((card) => {
                        const isSpeaking = speakingUsers.get(card.id) ?? false;

                        if (card.id === localUserId) {
                            if (isStreaming && stream) {
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
                            } else {
                                return (
                                    <div key={card.id} className="relative flex flex-col items-center justify-center aspect-video rounded-lg overflow-hidden bg-[#232428] border border-black/30">
                                        <div className="flex flex-col items-center justify-center w-full h-full">
                                            <div className="w-24 h-24 rounded-full bg-[#3f4147] text-white flex items-center justify-center text-4xl font-bold mb-2">
                                                {safeUsername.slice(0, 1).toUpperCase()}
                                            </div>
                                            <span className="text-lg font-semibold text-gray-200">{safeUsername}</span>
                                            <span className="text-xs text-gray-400 mt-1">Aucun stream en cours</span>
                                        </div>
                                    </div>
                                );
                            }
                        }

                        const remoteVideo = remoteVideoStreams.get(card.id);

                        if (remoteVideo) {
                            return (
                                <div key={card.id} className="relative" onContextMenu={(e) => handleContextMenu(e, card.id, card.username)}>
                                    <StreamCard
                                        stream={remoteVideo}
                                        username={card.username}
                                        isSpeaking={isSpeaking}
                                    />
                                </div>
                            );
                        }

                        return (
                            <div 
                                key={card.id} 
                                onContextMenu={(e) => handleContextMenu(e, card.id, card.username)}
                                className="relative aspect-video rounded-lg overflow-hidden bg-[#1e1f22] border border-black/30 transition-all duration-300 hover:scale-[1.01] cursor-pointer"
                            >
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
            )}

            {Array.from(remoteStreams.entries())
                .filter(([peerId]) => peerId !== localUserId)
                .map(([peerId, audioStream]) => (
                    <VoiceAudioRenderer key={peerId} stream={audioStream} muted={isDeafened} peerId={peerId} />
            ))}

            {contextMenu && (
                <UserContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    userId={contextMenu.userId}
                    username={contextMenu.username}
                    volume={userVolumes.get(contextMenu.userId) ?? 1}
                    onVolumeChange={(vol) => setUserVolume(contextMenu.userId, vol)}
                    onClose={() => setContextMenu(null)}
                />
            )}

            {updateAvailable && (
                <div className="fixed bottom-4 right-4 bg-blue-700 text-white px-4 py-2 rounded shadow-lg z-50">
                    <span>Une mise à jour est disponible ! </span>
                    <button className="ml-2 bg-white text-blue-700 px-2 py-1 rounded" onClick={triggerUpdate}>
                        Mettre à jour
                    </button>
                    <button className="ml-2 bg-white text-blue-700 px-2 py-1 rounded" onClick={checkForUpdate}>
                        Vérifier à nouveau
                    </button>
                </div>
            )}
            {updateStatus && (
                <div className="fixed bottom-16 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg z-50">
                    {updateStatus}
                </div>
            )}
        </MainLayout>
    );
};

export default Dashboard;
