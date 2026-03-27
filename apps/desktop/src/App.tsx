import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { StreamProvider } from './context/StreamContext';
import { VoiceProvider, useVoiceStore } from './context/VoiceContext';
import { LoginView } from "./components/auth/LoginView";
import { MainLayout } from './components/layout/MainLayout';
import { StreamCard } from './components/stream/StreamCard';
import { VoiceAudioRenderer } from './components/stream/VoiceAudioRenderer';
import { useStreamStore } from './context/StreamContext';
import { Hash, Headphones, LogOut, Mic, MicOff, Monitor, PhoneOff, Settings, Volume2, VolumeX } from 'lucide-react';

const Dashboard = () => {
    const { username, logout } = useAuth();
    const { stream, metrics, isStreaming, startCapture, stopCapture } = useStreamStore();
    const {
        channelId,
        participants,
        isConnected,
        isMuted,
        error,
        joinChannel,
        leaveChannel,
        toggleMute,
        remoteStreams,
        remoteVideoStreams,
        addScreenTrack,
        removeScreenTrack,
    } = useVoiceStore();
    const [isDeafened, setIsDeafened] = useState(false);

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
        { id: 'me', username: safeUsername, live: true },
        ...participants
            .filter((member) => member.username !== safeUsername)
            .slice(0, 3)
            .map((member) => ({ id: member.userId, username: member.username, live: false })),
    ];

    while (stageCards.length < 4) {
        stageCards.push({ id: `empty-${stageCards.length}`, username: 'Slot libre', live: false });
    }

    const handleLogout = () => {
        leaveChannel();
        logout();
    };

    const toggleDeafen = () => {
        setIsDeafened((prev) => !prev);
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
                />
            }
            rightPanel={
                <MembersPanel
                    participants={participants}
                    isConnected={isConnected}
                    channelId={channelId}
                    isMuted={isMuted}
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
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {stageCards.map((card) => {
                    if (card.id === 'me') {
                        return (
                            <div key={card.id} className="relative">
                                <StreamCard
                                    stream={stream}
                                    username={safeUsername}
                                    isBright={metrics.lum > 220}
                                />
                                {isDeafened && (
                                    <div
                                        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-red-500 border-2 border-[#232428] inline-flex items-center justify-center shadow-md"
                                        aria-label="Son entrant coupe"
                                        title="Son entrant coupe"
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
                                />
                            </div>
                        );
                    }

                    return (
                        <div key={card.id} className="relative aspect-video rounded-lg overflow-hidden bg-[#1e1f22] border border-black/30">
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-20 h-20 rounded-full bg-[#3f4147] text-white flex items-center justify-center text-2xl font-bold">
                                    {card.username.slice(0, 1).toUpperCase()}
                                </div>
                            </div>
                            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${card.username === 'Slot libre' ? 'bg-gray-500' : 'bg-green-500'}`} />
                                <span className="text-xs font-bold text-white">{card.username}</span>
                            </div>
                        </div>
                    );
                })}

                <div className="xl:col-span-2 rounded-lg bg-[#232428] border border-black/20 p-4">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wide mb-2">Activite vocale</h3>
                    <p className="text-gray-400 text-sm mb-1">
                        {isConnected ? `Connecte au salon ${channelId}` : 'Pas encore connecte a un salon vocal'}
                    </p>
                    <p className="text-xs text-gray-500">WebRTC audio en pair-a-pair (mesh).</p>
                </div>
            </div>

            {Array.from(remoteStreams.entries()).map(([peerId, audioStream]) => (
                <VoiceAudioRenderer key={peerId} stream={audioStream} muted={isDeafened} />
            ))}
        </MainLayout>
    );
};

interface SidebarContentProps {
    channelId: string | null;
    isConnected: boolean;
    isMuted: boolean;
    isDeafened: boolean;
    error: string | null;
    onJoin: (channelId: string) => void;
    onLeave: () => void;
    onToggleMute: () => void;
    onToggleDeafen: () => void;
    onLogout: () => void;
}

const SidebarContent = ({
    channelId,
    isConnected,
    isMuted,
    isDeafened,
    error,
    onJoin,
    onLeave,
    onToggleMute,
    onToggleDeafen,
    onLogout,
}: SidebarContentProps) => (
    <div className="flex flex-col h-full bg-[#2b2d31]">
        <div className="p-4 font-bold text-gray-400 uppercase text-[12px] tracking-wider">
            Salons Vocaux
        </div>

        <div className="px-2 space-y-2">
            <button
                onClick={() => onJoin('general')}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-white cursor-pointer transition-colors ${
                    channelId === 'general' ? 'bg-[#5865f2]' : 'bg-[#35373c] hover:bg-[#3f4147]'
                }`}
            >
                <Hash size={16} className="text-gray-300" />
                General
            </button>
            <button
                onClick={() => onJoin('sos')}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-white cursor-pointer transition-colors ${
                    channelId === 'sos' ? 'bg-[#5865f2]' : 'bg-[#35373c] hover:bg-[#3f4147]'
                }`}
            >
                <Hash size={16} className="text-gray-300" />
                SOS
            </button>
        </div>

        <div className="px-4 py-3 text-xs text-gray-300 space-y-1 border-b border-black/10 mt-3">
            <div>Etat: {isConnected ? 'Connecte' : 'Hors ligne'}</div>
            <div>Canal: {channelId ?? 'Aucun'}</div>
            <div>Micro: {isMuted ? 'Mute' : 'Actif'}</div>
            <div>Son entrant: {isDeafened ? 'Coupe' : 'Actif'}</div>
            {error && <div className="text-red-400">Erreur: {error}</div>}
        </div>

        <div className="px-2 mt-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 px-2 mb-2">Canaux texte</div>
            <button className="w-full flex items-center gap-2 text-left text-sm text-gray-300 px-2 py-1 rounded hover:bg-[#3f4147] transition-colors">
                <Hash size={14} className="text-gray-400" />
                annonces
            </button>
            <button className="w-full flex items-center gap-2 text-left text-sm text-gray-300 px-2 py-1 rounded hover:bg-[#3f4147] transition-colors">
                <Hash size={14} className="text-gray-400" />
                logs
            </button>
        </div>

        <div className="flex-1" />

        <div className="p-4 border-t border-black/10">
            <div className="flex gap-2 mb-3">
                <button
                    onClick={onToggleMute}
                    disabled={!channelId}
                    title={isMuted ? 'Unmute' : 'Mute'}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                    aria-pressed={isMuted}
                    className="w-9 h-9 rounded-full bg-[#35373c] hover:bg-[#3f4147] disabled:opacity-50 cursor-pointer inline-flex items-center justify-center"
                >
                    {isMuted ? <MicOff size={16} className="text-red-300" /> : <Mic size={16} className="text-gray-100" />}
                </button>
                <button
                    onClick={onToggleDeafen}
                    disabled={!channelId}
                    title={isDeafened ? 'Activer le son entrant' : 'Couper le son entrant'}
                    aria-label={isDeafened ? 'Activer le son entrant' : 'Couper le son entrant'}
                    aria-pressed={isDeafened}
                    className="w-9 h-9 rounded-full bg-[#35373c] hover:bg-[#3f4147] disabled:opacity-50 cursor-pointer inline-flex items-center justify-center"
                >
                    <Headphones size={16} className={isDeafened ? 'text-red-300' : 'text-gray-100'} />
                </button>
                <button
                    onClick={onLeave}
                    disabled={!channelId}
                    className="flex-1 text-xs px-2 py-2 rounded bg-red-500/90 hover:bg-red-500 disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-1"
                >
                    <PhoneOff size={14} />
                    Quitter
                </button>
            </div>

            <button
                onClick={onLogout}
                className="text-xs text-red-400 hover:text-red-300 hover:underline cursor-pointer inline-flex items-center gap-1"
            >
                <LogOut size={14} />
                Se déconnecter
            </button>
        </div>
    </div>
);

const MembersPanel = ({
    participants,
    isConnected,
    channelId,
    isMuted,
}: {
    participants: { userId: string; username: string }[];
    isConnected: boolean;
    channelId: string | null;
    isMuted: boolean;
}) => (
    <div className="h-full flex flex-col">
        <div className="h-12 px-4 flex items-center border-b border-black/20 text-sm font-semibold text-gray-200">
            Membres vocaux
        </div>
        <div className="px-4 py-3 text-xs text-gray-400 border-b border-black/20">
            {isConnected ? `Connecte sur ${channelId}` : 'Aucune connexion vocale'}
        </div>
        <div className="flex-1 p-3 space-y-2 overflow-y-auto">
            {participants.length === 0 && (
                <div className="text-xs text-gray-500">Personne dans le salon pour le moment.</div>
            )}
            {participants.map((member) => (
                <div key={member.userId} className="flex items-center gap-2 bg-[#35373c] rounded-md px-3 py-2">
                    <div className="w-7 h-7 rounded-full bg-[#5865f2] text-white text-xs font-bold flex items-center justify-center">
                        {member.username.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-100 truncate flex-1">{member.username}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold ${isMuted ? 'text-red-300' : 'text-green-300'}`}>
                        {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                        {isMuted ? 'Mute' : 'Live'}
                    </span>
                </div>
            ))}
        </div>
    </div>
);

const UserBar = ({
    username,
    isConnected,
    isMuted,
    onToggleMute,
    isDeafened,
    onToggleDeafen,
    channelId,
}: {
    username: string;
    isConnected: boolean;
    isMuted: boolean;
    onToggleMute: () => void;
    isDeafened: boolean;
    onToggleDeafen: () => void;
    channelId: string | null;
}) => (
    <div className="w-full flex items-center gap-2">
        <div className="relative w-8 h-8 rounded-full bg-[#5865f2] flex items-center justify-center text-xs font-bold text-white">
            {username.slice(0, 1).toUpperCase()}
            {isDeafened && (
                <span className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full bg-red-500 border-2 border-[#232428] inline-flex items-center justify-center">
                    <Headphones size={9} className="text-white" />
                </span>
            )}
        </div>
        {isDeafened && <span className="sr-only">Son entrant coupe</span>}
        <div className="flex-1 min-w-0">
            <div className="text-sm text-white truncate font-semibold">{username}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">
                {isConnected ? (isMuted ? 'En vocal - mute' : 'En vocal') : 'Hors vocal'}
            </div>
        </div>
        <div className="flex items-center gap-1">
            <button
                onClick={onToggleMute}
                disabled={!channelId}
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                aria-pressed={isMuted}
                className="w-7 h-7 rounded bg-[#3f4147] hover:bg-[#4a4d55] disabled:opacity-50 inline-flex items-center justify-center cursor-pointer"
            >
                {isMuted ? <MicOff size={14} className="text-red-300" /> : <Mic size={14} className="text-gray-200" />}
            </button>
            <button
                onClick={onToggleDeafen}
                disabled={!channelId}
                title={isDeafened ? 'Activer le son entrant' : 'Couper le son entrant'}
                aria-label={isDeafened ? 'Activer le son entrant' : 'Couper le son entrant'}
                aria-pressed={isDeafened}
                className="w-7 h-7 rounded bg-[#3f4147] hover:bg-[#4a4d55] disabled:opacity-50 inline-flex items-center justify-center cursor-pointer"
            >
                <Headphones size={14} className={isDeafened ? 'text-red-300' : 'text-gray-200'} />
            </button>
            <button className="w-7 h-7 rounded bg-[#3f4147] hover:bg-[#4a4d55] inline-flex items-center justify-center cursor-pointer">
                <Settings size={14} className="text-gray-200" />
            </button>
        </div>
    </div>
);

const BottomActions = ({
    metricsLum,
    metricsStatus,
    isStreaming,
    onToggleStream,
    isMuted,
    onToggleMute,
    isDeafened,
    onToggleDeafen,
    channelId,
}: {
    metricsLum: number;
    metricsStatus: string;
    isStreaming: boolean;
    onToggleStream: () => void;
    isMuted: boolean;
    onToggleMute: () => void;
    isDeafened: boolean;
    onToggleDeafen: () => void;
    channelId: string | null;
}) => (
    <div className="w-full flex items-center justify-between gap-4">
        <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-gray-500">Flux Rust WASM</span>
            <span className={metricsLum > 220 ? 'text-red-400 font-mono' : 'text-green-400 font-mono'}>
                {metricsStatus} (Lum: {metricsLum})
            </span>
        </div>

        <div className="flex items-center gap-2">
            <button
                onClick={onToggleMute}
                disabled={!channelId}
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                aria-pressed={isMuted}
                className="w-10 h-10 rounded-full font-semibold bg-[#3f4147] hover:bg-[#4a4d55] disabled:opacity-50 text-white cursor-pointer inline-flex items-center justify-center"
            >
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            <button
                onClick={onToggleDeafen}
                disabled={!channelId}
                title={isDeafened ? 'Activer le son entrant' : 'Couper le son entrant'}
                aria-label={isDeafened ? 'Activer le son entrant' : 'Couper le son entrant'}
                aria-pressed={isDeafened}
                className="w-10 h-10 rounded-full font-semibold bg-[#3f4147] hover:bg-[#4a4d55] disabled:opacity-50 text-white cursor-pointer inline-flex items-center justify-center"
            >
                <Headphones size={16} className={isDeafened ? 'text-red-300' : 'text-gray-100'} />
            </button>

            <button
                onClick={onToggleStream}
                className={`px-6 py-2 rounded-full font-bold transition-all inline-flex items-center gap-2 ${
                    isStreaming ? 'bg-red-500 hover:bg-red-600' : 'bg-[#248046] hover:bg-[#1a6334]'
                } text-white cursor-pointer`}
            >
                <Monitor size={16} />
                {isStreaming ? 'Arreter le partage' : 'Partager l\'ecran'}
            </button>
        </div>
    </div>
);

export default function App() {
    const { isAuthenticated, login } = useAuth();

    return (
        <VoiceProvider>
            <StreamProvider>
                {isAuthenticated ? <Dashboard /> : <LoginView onLogin={login} />}
            </StreamProvider>
        </VoiceProvider>
    );
}