import { ServerChannel } from './server.model';

export default interface ChannelItemProps {
  channel: ServerChannel;
  isActive: boolean;
  onSelect: (channelId: string) => void;
  onDelete?: (channelId: string) => void;
  showActions?: boolean;
}

