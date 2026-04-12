import { useState } from 'react';
import { ChevronDown, Plus, Settings, Hash, Users } from 'lucide-react';
import { ServerChannel } from '../../models/server/server.model';
import { ChannelItem } from './ChannelItem';
import { CreateChannelModal } from './CreateChannelModal';
import { VoiceParticipantCard } from './VoiceParticipantCard';
import { ServerSettingsModal } from '../ui/ServerSettingsModal';
import { ServerMembersPanel } from '../sidebar/ServerMembersPanel';
import { useServerMembers } from '../../hooks/useServerMembers';
import ChannelListProps from '../../models/channel/channelListProps.model';

/**
 * Displays the list of channels for a server with category headers.
 * Handles voice joining and text selection separately.
 */
export const ChannelList = ({
  server,
  activeChannelId,
  onSelectChannel,
  onCreateChannel,
  onDeleteChannel,
  onDeleteServer,
  onJoinVoice,
  isOwner = false,
  participants = [],
  speakingUsers = new Map(),
  voiceChannelId,
}: ChannelListProps) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [membersExpanded, setMembersExpanded] = useState(true);

  const { members: resolvedMembers, loading: membersLoading } = useServerMembers(
    server.id,
    server.ownerPublicKey,
  );

  const textChannels = server.channels.filter(c => c.type === 'text');
  const voiceChannels = server.channels.filter(c => c.type !== 'text');

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  };

  const handleChannelClick = (channel: ServerChannel) => {
    if (channel.type !== 'text') {
      onJoinVoice?.(channel.id);
    }
    onSelectChannel(channel.id);
  };

  const renderCategory = (title: string, channels: ServerChannel[]) => {
    const isCollapsed = collapsedCategories.has(title);

    return (
      <div key={title} className="mt-5">
        <div
          className="flex items-center justify-between px-4 mb-2 cursor-pointer group"
          onClick={() => toggleCategory(title)}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-black text-cyan-500/70 uppercase tracking-[0.15em] group-hover:text-cyan-400 transition-colors">
            <ChevronDown
              size={12}
              className={`transition-transform duration-300 ${isCollapsed ? '-rotate-90 text-cyan-500/50' : 'text-cyan-400'}`}
            />
            {title}
          </div>
          {isOwner && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsCreateModalOpen(true); }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-cyan-500/20 rounded-md text-cyan-500/70 hover:text-cyan-300 transition-all duration-200 border border-transparent hover:border-cyan-500/30 hover:shadow-[0_0_10px_rgba(34,211,238,0.2)]"
            >
              <Plus size={14} />
            </button>
          )}
        </div>

        <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'}`}>
          <div className="flex flex-col gap-0.5">
            {channels.map(channel => (
              <div key={channel.id}>
                <ChannelItem
                  channel={channel}
                  isActive={activeChannelId === channel.id || voiceChannelId === channel.id}
                  onSelect={() => handleChannelClick(channel)}
                />
                {voiceChannelId === channel.id && channel.type !== 'text' && participants.length > 0 && (
                  <div className="ml-8 pl-3 border-l-2 border-cyan-500/20 my-1 py-1 flex flex-col gap-0.5 transition-all duration-300">
                    {participants.map(p => (
                      <VoiceParticipantCard
                        key={p.userId}
                        username={p.username}
                        userId={p.userId}
                        isMuted={p.isMuted}
                        isDeafened={p.isDeafened}
                        isSpeaking={speakingUsers.get(p.userId) ?? false}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const _memberCount = resolvedMembers.length || server.members.length;

  return (
    <div className="flex flex-col h-full bg-[#050511]/60">
      {/* Server header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-cyan-500/10 shadow-[0_4px_15px_rgba(0,0,0,0.3)] shrink-0 cursor-pointer hover:bg-cyan-500/5 transition-colors group">
        <span className="font-black text-[15px] uppercase tracking-wider text-cyan-50 truncate filter drop-shadow-[0_0_8px_rgba(34,211,238,0.4)] group-hover:text-cyan-200">{server.name}</span>
        {isOwner && (
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 hover:bg-cyan-500/20 rounded-md text-cyan-500/70 hover:text-cyan-300 transition-colors border border-transparent hover:border-cyan-500/40 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]"
          >
            <Settings size={16} />
          </button>
        )}
      </div>

      {/* Channels — scrollable, takes remaining space */}
      <div className="flex-1 min-h-0 overflow-y-auto py-3 custom-scrollbar">
        {textChannels.length > 0 && renderCategory('Salons textuels', textChannels)}
        {voiceChannels.length > 0 && renderCategory('Salons vocaux', voiceChannels)}

        {server.channels.length === 0 && (
          <div className="px-4 py-10 mt-10 text-center flex flex-col items-center justify-center animate-in fade-in duration-500">
            <div className="w-16 h-16 rounded-2xl bg-cyan-900/20 flex items-center justify-center border border-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.1)] mb-4">
               <Hash className="w-8 h-8 text-cyan-500/40" />
            </div>
            <p className="text-cyan-100/50 text-sm font-medium">Aucun salon.</p>
            {isOwner && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-3 text-[12px] uppercase font-bold tracking-widest text-cyan-400 hover:text-cyan-300 hover:underline shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all"
              >
                Créer un salon
              </button>
            )}
          </div>
        )}
      </div>

      {/* Members — collapsable bottom section with its own scroll */}
      <div className={`shrink-0 border-t border-cyan-500/10 flex flex-col transition-all duration-300 ${membersExpanded ? 'max-h-[40%]' : 'max-h-9'} overflow-hidden`}>
        <button
          onClick={() => setMembersExpanded(prev => !prev)}
          className="flex items-center justify-between px-4 py-2 hover:bg-cyan-500/5 transition-colors shrink-0"
        >
          <div className="flex items-center gap-1.5 text-[11px] font-black text-cyan-500/70 uppercase tracking-[0.15em]">
            <Users size={11} />
            Membres — {_memberCount}
          </div>
          <ChevronDown
            size={12}
            className={`text-cyan-500/50 transition-transform duration-300 ${membersExpanded ? '' : '-rotate-90'}`}
          />
        </button>
        {membersExpanded && (
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-2">
            <ServerMembersPanel members={resolvedMembers} loading={membersLoading} />
          </div>
        )}
      </div>

      <CreateChannelModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={onCreateChannel}
      />

      {isOwner && (
        <ServerSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          server={server}
          onDeleteChannel={onDeleteChannel}
          onDeleteServer={onDeleteServer}
        />
      )}
    </div>
  );
};
