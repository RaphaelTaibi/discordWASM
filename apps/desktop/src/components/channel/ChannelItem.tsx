import { Hash, Volume2, Video, Trash2 } from 'lucide-react';
import { ServerChannel } from '../../models/server.model';

interface ChannelItemProps {
  channel: ServerChannel;
  isActive: boolean;
  onSelect: (channelId: string) => void;
  onDelete?: (channelId: string) => void;
  showActions?: boolean;
}

/**
 * Reusable channel item component displaying a channel with its icon based on type.
 * Can be used in any server's channel list.
 */
export const ChannelItem = ({ 
  channel, 
  isActive, 
  onSelect, 
  onDelete,
  showActions = false 
}: ChannelItemProps) => {
  
  const getIcon = () => {
    switch (channel.type) {
      case 'voice':
        return <Volume2 size={16} className={`shrink-0 transition-colors ${isActive ? 'text-cyan-400' : 'text-cyan-500/50 group-hover:text-cyan-300'}`} />;
      case 'video':
        return <Video size={16} className={`shrink-0 transition-colors ${isActive ? 'text-cyan-400' : 'text-cyan-500/50 group-hover:text-cyan-300'}`} />;
      case 'text':
      default:
        return <Hash size={16} className={`shrink-0 transition-colors ${isActive ? 'text-cyan-400' : 'text-cyan-500/50 group-hover:text-cyan-300'}`} />;
    }
  };

  return (
    <div
      className={`group relative flex items-center gap-2.5 px-3 py-2 mx-2 mb-0.5 rounded-lg cursor-pointer transition-all duration-300 overflow-hidden
        ${isActive 
          ? 'bg-cyan-500/10 text-cyan-100 shadow-[0_0_15px_rgba(34,211,238,0.15)] border border-cyan-500/30 font-bold' 
          : 'bg-transparent text-cyan-100/60 border border-transparent hover:bg-[#050511] font-medium hover:text-cyan-100 hover:border-cyan-500/20 hover:shadow-[0_0_10px_rgba(34,211,238,0.05)]'
        }`}
      onClick={() => onSelect(channel.id)}
    >
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] rounded-r-full" />
      )}
      
      {getIcon()}
      <span className="truncate text-[14px] flex-1 tracking-wide">{channel.name}</span>
      
      {showActions && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 z-10">
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(channel.id);
              }}
              className="p-1.5 hover:bg-red-500/20 rounded-md text-cyan-500/50 hover:text-red-400 transition-colors hover:shadow-[0_0_10px_rgba(248,113,113,0.3)]"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
