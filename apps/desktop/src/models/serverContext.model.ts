import { Server, ServerChannel } from './server.model';

export default interface ServerContextProps {
  servers: Server[];
  activeServerId: string | null;
  setActiveServerId: (id: string | null) => void;
  createServer: (name: string) => void;
  joinServer: (inviteKey: string) => void;
  createChannel: (serverId: string, channel: Omit<ServerChannel, 'id'>) => void;
  deleteChannel: (serverId: string, channelId: string) => void;
}

