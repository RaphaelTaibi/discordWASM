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
import { Headphones, Video } from 'lucide-react';
import { useTauriUpdater } from '../lib/useTauriUpdater';
import { SidebarView } from '../models/sidebarContentProps.model';
import { ChatPanel } from './chat/ChatPanel';
import { UserContextMenu } from './ui/UserContextMenu';
import { SettingsModal } from './ui/SettingsModal';
import { Download, X } from 'lucide-react';
import { useServer } from '../context/ServerContext';
import { ChannelList } from './channel/ChannelList';

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
        channelStartedAt,
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
        setUserVolume,
        voiceAvatar
    } = useVoiceStore();

    const { servers, activeServerId, createChannel, deleteChannel } = useServer();

    const [activeView, setActiveView] = useState<SidebarView>('voice');
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, userId: string, username: string } | null>(null);
    const [focusedUserId, setFocusedUserId] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
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
    const [showUpdateToast, setShowUpdateToast] = useState(false);

    useEffect(() => {
        if (updateAvailable) {
            setShowUpdateToast(true);
        }
    }, [updateAvailable]);

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

    /**
     * Rejoindre un channel, et stopper le stream d'écran existant.
     * @param {string} targetChannelId Identifiant du canal cible
     * @param {'voice' | 'text' | 'video'} type Type de canal
     */
    const customJoinChannel = (targetChannelId: string, type: 'voice' | 'text' | 'video' = 'voice') => {
        if (type === 'text') {
            setActiveView('chat');
            // Store text channel ID somewhere or use it for chat
            return;
        }

        if (channelId && channelId !== targetChannelId && isStreaming) {
            stopCapture();
        }
        joinChannel(targetChannelId, safeUsername);
        setActiveView('voice');
    };

    /**
     * Quitter le canal, et stopper le stream d'écran.
     */
    const customLeaveChannel = () => {
        if (isStreaming) {
            stopCapture();
        }
        leaveChannel();
    };

    const activeServer = servers.find(s => s.id === activeServerId);

    return (
        <div className="flex h-screen bg-[#0a0014] text-gray-100 overflow-hidden font-sans">
            <MainLayout
                channelName={channelName}
                sidebar={
                    (activeServerId && activeServerId !== 'sos' && activeServer) ? (
                        <ChannelList
                            server={activeServer}
                            activeChannelId={channelId}
                            onSelectChannel={(cId) => {
                                const channel = activeServer.channels.find(c => c.id === cId);
                                if (channel) {
                                    customJoinChannel(cId, channel.type);
                                }
                            }}
                            onCreateChannel={(channel) => createChannel(activeServer.id, channel)}
                            onDeleteChannel={(cId) => deleteChannel(activeServer.id, cId)}
                            isOwner={true} // TODO: Check if user is owner
                            participants={participants}
                            speakingUsers={speakingUsers}

                        />
                    ) : (
                        <SidebarContent
                            channelId={channelId}
                            isConnected={isConnected}
                            isMuted={isMuted}
                            isDeafened={isDeafened}
                            error={error}
                            onJoin={customJoinChannel}
                            onLeave={customLeaveChannel}
                            onToggleMute={toggleMute}
                            onToggleDeafen={toggleDeafen}
                            onLogout={handleLogout}
                            updateCheck={checkForUpdate}
                            salons={salons}
                            localUserId={localUserId}
                            activeView={activeView}
                            onViewChange={setActiveView}
                            speakingUsers={speakingUsers}
                            channelStartedAt={channelStartedAt}
                        />
                    )
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
                        onLeave={customLeaveChannel}
                        onLogout={handleLogout}
                        onStream={handleStreamToggle}
                        isStreaming={isStreaming}
                        networkQuality={networkQuality as 0 | 1 | 2 | 3}
                        ping={ping}
                        updateCheck={checkForUpdate}
                        onOpenSettings={() => setIsSettingsOpen(true)}
                        avatarUrl={voiceAvatar}
                    />
                }
            >
                {activeView === 'chat' ? (
                    <ChatPanel />
                ) : (
                    <div className={`flex flex-col h-full gap-3 ${focusedUserId ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                        {focusedUserId && (
                            <div className="flex-1 min-h-0 w-full bg-[#050511]/80 border border-cyan-500/20 backdrop-blur-md rounded-xl overflow-hidden flex items-center justify-center relative shadow-[0_0_30px_rgba(34,211,238,0.1)] mt-4">
                                <button 
                                    className="absolute top-4 right-4 z-50 bg-[#0a0b14]/80 border border-cyan-500/30 hover:bg-cyan-500/20 hover:border-cyan-400 text-cyan-100 rounded-lg px-4 py-1.5 backdrop-blur-sm transition-all duration-300 shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                                    onClick={() => setFocusedUserId(null)}
                                >
                                    Réduire
                                </button>
                                {stageCards.filter(c => c.id === focusedUserId).map((card) => {
                                    const isSpeaking = speakingUsers.get(card.id) ?? false;
                                    
                                    if (card.id === localUserId) {
                                        if (isStreaming && stream) {
                                            return (
                                                <div key={`focus-${card.id}`} className="w-full h-full flex items-center justify-center">
                                                    <StreamCard
                                                        stream={stream}
                                                        username={safeUsername}
                                                        isBright={metrics.lum > 220}
                                                        isSpeaking={isSpeaking}
                                                    />
                                                </div>
                                            );
                                        } else {
                                            return (
                                                <div key={`focus-${card.id}`} className={`relative w-[92%] max-w-[92%] h-[92%] max-h-[92%] mx-auto my-auto rounded-lg overflow-hidden flex flex-col items-center justify-center text-white bg-[#1e1f22] ${isSpeaking ? 'ring-4 ring-green-500 ring-offset-4 ring-offset-black shadow-[0_0_20px_rgba(34,197,94,0.4)]' : ''}`}>
                                                    {voiceAvatar ? (
                                                        <>
                                                            <img src={voiceAvatar} alt={safeUsername} className="w-full h-full object-cover" />
                                                            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded flex items-center gap-2 z-20">
                                                                <span className="text-sm font-bold text-white">{safeUsername}</span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                                <div className={`w-32 h-32 rounded-full bg-[#050511] border border-cyan-500/20 text-cyan-200 flex items-center justify-center text-6xl font-black mb-6 shadow-[0_0_40px_rgba(34,211,238,0.15)] relative ${isSpeaking ? 'ring-2 ring-cyan-400 shadow-[0_0_40px_rgba(34,211,238,0.5)] scale-105 transition-all duration-300' : 'transition-all duration-500'}`}>
                                                                {safeUsername.slice(0, 1).toUpperCase()}
                                                            </div>
                                                            <span className="text-xl tracking-[0.2em] font-black uppercase text-cyan-100/80 bg-[#0a0b14]/50 backdrop-blur border border-cyan-500/10 px-4 py-1.5 rounded">{safeUsername}</span>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        }
                                    }

                                    const remoteVideo = remoteVideoStreams.get(card.id);
                                    if (remoteVideo) {
                                        return (
                                            <div key={`focus-${card.id}`} className="w-full h-full flex items-center justify-center">
                                                <StreamCard
                                                    stream={remoteVideo}
                                                    username={card.username}
                                                    isSpeaking={isSpeaking}
                                                />
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={`focus-${card.id}`} className="w-full h-full flex flex-col items-center justify-center text-cyan-100 relative">
                                            <div className="absolute inset-0 transition-opacity duration-1000 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent pointer-events-none" />
                                            <div className={`w-32 h-32 rounded-full bg-[#050511] border border-cyan-500/20 text-cyan-200 flex items-center justify-center text-6xl font-black mb-6 shadow-[0_0_40px_rgba(34,211,238,0.15)] relative z-10 ${isSpeaking ? 'ring-2 ring-cyan-400 shadow-[0_0_50px_rgba(34,211,238,0.5)] scale-105 transition-all duration-300' : 'transition-all duration-500'}`}>
                                                {card.username.slice(0, 1).toUpperCase()}
                                            </div>
                                            <span className="text-xl tracking-[0.2em] font-black uppercase text-cyan-100/80 bg-[#0a0b14]/50 backdrop-blur border border-cyan-500/10 px-4 py-1.5 rounded relative z-10">{card.username}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        
                        <div className={focusedUserId 
                            ? "h-48 flex-shrink-0 flex gap-2 overflow-x-auto overflow-y-hidden pb-2 snap-x mt-4" 
                            : `grid gap-3 mt-4 ${
                                stageCards.length === 1 ? 'grid-cols-1' :
                                stageCards.length <= 4 ? 'grid-cols-1 xl:grid-cols-2' :
                                'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                            }`
                        }>
                            {stageCards.map((card) => {
                                const isSpeaking = speakingUsers.get(card.id) ?? false;
                                
                                        const cardClassName = focusedUserId
                                    ? `relative shrink-0 w-60 h-full rounded-xl overflow-hidden bg-[#0d0f1a]/80 border border-cyan-500/20 backdrop-blur-md transition-all duration-500 hover:scale-[1.02] cursor-pointer snap-center shadow-[0_4px_20px_rgba(0,0,0,0.3)] ${focusedUserId === card.id ? 'ring-2 ring-cyan-400/80 shadow-[0_0_20px_rgba(34,211,238,0.3)]' : ''}`
                                    : `relative flex flex-col items-center justify-center aspect-video w-[92%] max-w-[92%] mx-auto rounded-xl overflow-hidden bg-[#0d0f1a]/80 border border-cyan-500/20 backdrop-blur-md transition-all duration-500 hover:scale-[1.02] cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-cyan-400/50 hover:shadow-[0_0_25px_rgba(34,211,238,0.2)] ${isSpeaking ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-[#050511] shadow-[0_0_30px_rgba(34,211,238,0.5)]' : ''}`;

                                const handleCardClick = () => setFocusedUserId(card.id);

                                if (card.id === localUserId) {
                                    if (isStreaming && stream) {
                                        return (
                                            <div key={card.id} className={cardClassName} onClick={handleCardClick}>
                                                {focusedUserId === card.id ? (
                                                    <>
                                                        <div className="absolute inset-0 flex items-center justify-center bg-[#1e1f22]">
                                                                <div className={`relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-cyan-600/40 to-purple-600/40 text-cyan-50 font-black text-xl transition-all duration-500 shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-cyan-500/30 ${
                                                                isSpeaking ? 'ring-2 ring-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.6)] scale-110' : ''
                                                            }`}>
                                                                {safeUsername.slice(0, 1).toUpperCase()}
                                                                <div className="absolute -bottom-1 -right-1 bg-[#050511] rounded-full p-1 border border-cyan-500/50">
                                                                    <Video size={10} className="text-cyan-400" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="absolute bottom-2 left-2 bg-[#050511]/80 backdrop-blur-md border border-cyan-500/20 px-3 py-1 rounded-md flex items-center gap-2">
                                                            <span className="text-[10px] uppercase font-bold text-cyan-200 tracking-wider mix-blend-screen">{safeUsername}</span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <StreamCard
                                                        stream={stream}
                                                        username={safeUsername}
                                                        isBright={metrics.lum > 220}
                                                        isSpeaking={isSpeaking}
                                                    />
                                                )}
                                                {isDeafened && (
                                                    <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-red-500 border-2 border-[#232428] inline-flex items-center justify-center shadow-md z-10">
                                                        <Headphones size={13} className="text-white" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div key={card.id} className={cardClassName} onClick={handleCardClick}>
                                                {voiceAvatar ? (
                                                    <>
                                                        <img src={voiceAvatar} alt={safeUsername} className="w-full h-full object-cover" />
                                                        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded flex items-center gap-2 z-20">
                                                            <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${isSpeaking ? 'bg-green-500 animate-pulse' : 'bg-green-500'}`} />
                                                            <span className="text-xs font-bold text-white">{safeUsername}</span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center w-full h-full relative">
                                                        <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/10 via-transparent to-purple-900/10 pointer-events-none" />
                                                        <div className={`${focusedUserId ? 'w-16 h-16 text-2xl' : 'w-24 h-24 text-4xl'} rounded-full bg-[#050511] border border-cyan-500/30 text-cyan-200 flex items-center justify-center font-black mb-3 shadow-[0_0_30px_rgba(34,211,238,0.15)] relative z-10`}>
                                                            {safeUsername.slice(0, 1).toUpperCase()}
                                                        </div>
                                                        <span className={`${focusedUserId ? 'text-xs' : 'text-sm'} font-bold tracking-widest uppercase text-cyan-100 relative z-10 bg-[#050511]/50 px-3 py-1 rounded-md border border-cyan-500/20 backdrop-blur-sm`}>{safeUsername}</span>
                                                        {!focusedUserId && <span className="text-[10px] uppercase tracking-widest text-cyan-500/50 mt-3 relative z-10 font-bold bg-[#0a0b14] px-2 py-0.5 rounded border border-cyan-500/10">No Stream</span>}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                }

                                const remoteVideo = remoteVideoStreams.get(card.id);

                                if (remoteVideo) {
                                    return (
                                        <div key={card.id} className={cardClassName} onClick={handleCardClick} onContextMenu={(e) => handleContextMenu(e, card.id, card.username)}>
                                            {focusedUserId === card.id ? (
                                                <>
                                                    <div className="absolute inset-0 flex items-center justify-center bg-[#1e1f22]">
                                                                <div className={`relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-cyan-600/40 to-purple-600/40 text-cyan-50 font-black text-xl transition-all duration-500 shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-cyan-500/30 ${
                                                            isSpeaking ? 'ring-2 ring-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.6)] scale-110' : ''
                                                        }`}>
                                                            {card.username.slice(0, 1).toUpperCase()}
                                                            <div className="absolute -bottom-1 -right-1 bg-[#050511] rounded-full p-1 border border-cyan-500/50">
                                                                <Video size={10} className="text-cyan-400" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="absolute bottom-2 left-2 bg-[#050511]/80 backdrop-blur-md border border-cyan-500/20 px-3 py-1 rounded-md flex items-center gap-2">
                                                        <span className="text-[10px] uppercase font-bold text-cyan-200 tracking-wider mix-blend-screen">{card.username}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <StreamCard
                                                    stream={remoteVideo}
                                                    username={card.username}
                                                    isSpeaking={isSpeaking}
                                                />
                                            )}
                                        </div>
                                    );
                                }

                                return (
                                    <div 
                                        key={card.id} 
                                        onClick={handleCardClick}
                                        onContextMenu={(e) => handleContextMenu(e, card.id, card.username)}
                                        className={`${cardClassName} !bg-[#050511]`}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-900/10 via-transparent to-purple-900/10 pointer-events-none" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className={`${focusedUserId ? 'w-14 h-14 text-xl' : 'w-20 h-20 text-3xl'} rounded-full bg-[#0a0b14] border border-cyan-500/30 text-cyan-200 flex items-center justify-center font-black transition-all duration-500 shadow-[0_0_20px_rgba(34,211,238,0.15)] relative z-10 ${
                                                isSpeaking ? 'ring-2 ring-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.5)] scale-110' : ''
                                            }`}>
                                                {card.username.slice(0, 1).toUpperCase()}
                                            </div>
                                        </div>
                                        <div className="absolute bottom-3 left-3 bg-[#0a0b14]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-cyan-500/20 shadow-[0_4px_15px_rgba(0,0,0,0.5)] flex items-center gap-2.5 z-20">
                                            <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 shadow-[0_0_10px_currentColor] ${
                                                isSpeaking ? 'bg-cyan-400 animate-pulse' : card.username === 'Slot libre' ? 'bg-gray-600' : 'bg-cyan-500/50'
                                            }`} />
                                            <span className="text-[10px] tracking-widest font-black text-cyan-50 uppercase">{card.username}</span>
                                        </div>
                                    </div>
                                );
                            })}
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

                {/* Petit Toast de mise à jour (Discord-like) */}
                {showUpdateToast && (
                    <div className="fixed bottom-6 right-6 bg-[#2b2d31] rounded-lg shadow-2xl border border-black/20 w-80 animate-in slide-in-from-bottom-8 fade-in z-[90]">
                        <div className="p-4">
                            <div className="flex items-start justify-between">
                                <div className="flex gap-3">
                                    <div className="mt-0.5 bg-[#23a55a]/20 p-2 rounded-full text-[#23a55a]">
                                        <Download size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-[#f2f3f5] font-bold text-[15px]">Mise à jour disponible</h4>
                                        <p className="text-[#b5bac1] text-[13px] mt-1 leading-tight">
                                            Une nouvelle version de l'application est prête à être installée.
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setShowUpdateToast(false)}
                                    className="text-[#b5bac1] hover:text-[#dbdee1] transition-colors"
                                    aria-label="Fermer"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="mt-4 flex justify-end gap-2">
                                <button 
                                    onClick={() => setIsSettingsOpen(true)}
                                    className="text-[#f2f3f5] hover:underline text-[13px] font-medium px-3 py-1.5"
                                >
                                    Voir les détails
                                </button>
                                <button 
                                    onClick={triggerUpdate}
                                    className="bg-[#23a55a] hover:bg-[#1a7f44] text-white text-[13px] font-medium px-4 py-1.5 rounded transition-colors"
                                >
                                    Mettre à jour
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <SettingsModal 
                    isOpen={isSettingsOpen} 
                    onClose={() => setIsSettingsOpen(false)} 
                    updateAvailable={updateAvailable}
                    updateStatus={updateStatus}
                    triggerUpdate={triggerUpdate}
                    checkForUpdate={checkForUpdate}
                />
            </MainLayout>
        </div>
    );
};

export default Dashboard;
