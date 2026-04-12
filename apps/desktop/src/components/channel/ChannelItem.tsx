import { Hash, Volume2 } from 'lucide-react';
import ChannelItemProps from '../../models/channel/channelItemProps.model';

/**
 * Reusable channel item displaying a channel with its type icon.
 */
export const ChannelItem = ({ channel, isActive, onSelect }: ChannelItemProps) => {

  const getIcon = () => {
    const cls = `shrink-0 transition-colors ${isActive ? 'text-cyan-400' : 'text-cyan-500/50 group-hover:text-cyan-300'}`;
    switch (channel.type) {
      case 'voice': return <Volume2 size={16} className={cls} />;
      default:      return <Hash size={16} className={cls} />;
    }
  };

  return (
    <div
      className={`group relative flex items-center gap-2.5 px-3 py-2 mx-2 mb-0.5 rounded-lg cursor-pointer transition-all duration-300 overflow-hidden
        ${isActive
          ? 'bg-cyan-500/10 text-cyan-100 shadow-[0_0_15px_rgba(34,211,238,0.15)] border border-cyan-500/30 font-bold'
          : 'bg-white/3 text-cyan-100/60 border border-transparent hover:bg-[#050511] font-medium hover:text-cyan-100 hover:border-cyan-500/20 hover:shadow-[0_0_10px_rgba(34,211,238,0.05)]'
        }`}
      onClick={() => onSelect(channel.id)}
    >
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] rounded-r-full" />
      )}

      {getIcon()}
      <span className="truncate text-[14px] flex-1 tracking-wide">{channel.name}</span>
    </div>
  );
};
