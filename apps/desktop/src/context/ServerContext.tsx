import { createContext, useContext, useState, PropsWithChildren } from 'react';
import { Server, ServerChannel } from '../models/server.model';
import ServerContextProps from '../models/serverContext.model';

const ServerContext = createContext<ServerContextProps | undefined>(undefined);

export const ServerProvider = ({ children }: PropsWithChildren) => {
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);

  const createServer = (name: string) => {
    const _id = crypto.randomUUID();
    const _newServer: Server = {
      id: _id,
      name,
      ownerPublicKey: '',
      inviteKey: '',
      channels: []
    };
    setServers(prev => [...prev, _newServer]);
    setActiveServerId(_id);
  };

  const joinServer = (inviteKey: string) => {
    // TODO: Call websocket / backend here
    console.log("Join server", inviteKey);
  };

  const createChannel = (serverId: string, channel: Omit<ServerChannel, 'id'>) => {
    setServers(prev => prev.map(server => {
      if (server.id === serverId) {
        return {
          ...server,
          channels: [...server.channels, { ...channel, id: crypto.randomUUID() }]
        };
      }
      return server;
    }));
  };

  const deleteChannel = (serverId: string, channelId: string) => {
    setServers(prev => prev.map(server => {
      if (server.id === serverId) {
        return {
          ...server,
          channels: server.channels.filter(c => c.id !== channelId)
        };
      }
      return server;
    }));
  };

  return (
    <ServerContext.Provider value={{
      servers,
      activeServerId,
      setActiveServerId,
      createServer,
      joinServer,
      createChannel,
      deleteChannel
    }}>
      {children}
    </ServerContext.Provider>
  );
};

export const useServer = () => {
  const context = useContext(ServerContext);
  if (!context) {
    throw new Error('useServer must be used within a ServerProvider');
  }
  return context;
};
