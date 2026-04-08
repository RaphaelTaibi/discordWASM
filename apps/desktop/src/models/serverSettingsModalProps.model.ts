import { Server } from './server.model';

export default interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: Server;
  onDeleteChannel?: (channelId: string) => void;
  onDeleteServer?: () => void;
}

