import { useEffect, useMemo, useState } from 'react';
import VoicePeer from '../models/voicePeer.model';
import VoiceTileProps from '../models/voiceTileProps.model';

/**
 * Builds tile data for the VoiceGrid by merging participant info,
 * remote streams, speaking state, and avatar.
 * Guarantees the local user tile is always present when a voice channel is active.
 */
export function useVoiceGrid({
    participants,
    localUserId,
    localUsername,
    localStream,
    localScreenStream,
    remoteStreams,
    remoteVideoStreams,
    speakingUsers,
    voiceAvatar,
    channelId,
    isMuted,
    isDeafened,
}: {
    participants: VoicePeer[];
    localUserId: string;
    localUsername: string;
    localStream: MediaStream | null;
    localScreenStream: MediaStream | null;
    remoteStreams: Map<string, MediaStream>;
    remoteVideoStreams: Map<string, MediaStream>;
    speakingUsers: Map<string, boolean>;
    voiceAvatar: string | null;
    channelId: string | null;
    isMuted: boolean;
    isDeafened: boolean;
}) {
    const [spotlightUserId, setSpotlightUserId] = useState<string | null>(null);

    const tiles: VoiceTileProps[] = useMemo(() => {
        if (!channelId || !localUserId) return [];

        // Ensure local user is always present even before server confirms
        const _hasLocal = participants.some(p => p.userId === localUserId);
        const _effectiveParticipants: VoicePeer[] = _hasLocal
            ? participants
            : [{ userId: localUserId, username: localUsername, isMuted, isDeafened }, ...participants];

        return _effectiveParticipants.map((p): VoiceTileProps => {
            const _isLocal = p.userId === localUserId;
            const _avatarUrl = _isLocal ? voiceAvatar : null;

            const _screenStream = _isLocal ? localScreenStream : null;

            return {
                userId: p.userId,
                username: p.username,
                isSpeaking: speakingUsers.get(p.userId) ?? false,
                isMuted: p.isMuted ?? false,
                isDeafened: p.isDeafened ?? false,
                videoStream: _isLocal ? localStream : (remoteVideoStreams.get(p.userId) ?? null),
                screenStream: _screenStream,
                avatarUrl: _avatarUrl,
                isLocal: _isLocal,
                isSpotlighted: spotlightUserId === p.userId,
                isWatchingSpotlight: spotlightUserId !== null && spotlightUserId !== p.userId,
            };
        });
    }, [participants, localUserId, localUsername, localStream, localScreenStream, remoteStreams, remoteVideoStreams, speakingUsers, voiceAvatar, spotlightUserId, channelId, isMuted, isDeafened]);

    /** Auto-exit spotlight when the spotlighted user stops streaming. */
    useEffect(() => {
        if (!spotlightUserId) return;
        const _spotlightTile = tiles.find(t => t.userId === spotlightUserId);
        if (!_spotlightTile?.screenStream) setSpotlightUserId(null);
    }, [tiles, spotlightUserId]);

    /** Only allow spotlight on tiles that are actively streaming. */
    const handleSpotlight = (userId: string | null) => {
        if (userId === null) {
            setSpotlightUserId(null);
            return;
        }
        const _tile = tiles.find(t => t.userId === userId);
        if (!_tile?.screenStream) return;
        setSpotlightUserId(prev => (prev === userId ? null : userId));
    };

    return { tiles, spotlightUserId, handleSpotlight };
}

