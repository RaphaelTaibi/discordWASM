import { createContext, useCallback, useContext, useEffect, useState, PropsWithChildren } from 'react';
import { Server, ServerChannel } from '../models/server.model';
import ServerContextProps from '../models/serverContext.model';
import { useAuth } from './AuthContext';
import * as serverApi from '../api/server.api';

const ServerContext = createContext<ServerContextProps | undefined>(undefined);

export const ServerProvider = ({ children }: PropsWithChildren) => {
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { publicKey, token } = useAuth();

  const fetchServers = useCallback(async () => {
    if (!token) {
      setServers([]);
      return;
    }
    setLoading(true);
    try {
      const _list = await serverApi.listServers();
      setServers(_list);
    } catch (err) {
      console.error('Failed to fetch servers:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Re-fetch whenever the auth token changes (login / logout / session restore)
  useEffect(() => { fetchServers(); }, [fetchServers]);

  // Reset selection on logout
  useEffect(() => {
    if (!token) setActiveServerId(null);
  }, [token]);

  const createServer = useCallback(async (name: string) => {
    if (!publicKey) return;
    const _server = await serverApi.createServer(name, publicKey);
    setServers(prev => [...prev, _server]);
    setActiveServerId(_server.id);
  }, [publicKey]);

  const deleteServer = useCallback(async (serverId: string) => {
    if (!publicKey) return;
    await serverApi.deleteServer(serverId, publicKey);
    setServers(prev => prev.filter(s => s.id !== serverId));
    if (activeServerId === serverId) setActiveServerId(null);
  }, [publicKey, activeServerId]);

  const joinServer = useCallback(async (inviteKey: string) => {
    if (!publicKey) return;
    const _server = await serverApi.joinServerByInvite(inviteKey, publicKey);
    setServers(prev => {
      const _exists = prev.some(s => s.id === _server.id);
      return _exists ? prev.map(s => s.id === _server.id ? _server : s) : [...prev, _server];
    });
    setActiveServerId(_server.id);
  }, [publicKey]);

  const createChannel = useCallback(async (serverId: string, channel: Omit<ServerChannel, 'id'>) => {
    if (!publicKey) return;
    const _updated = await serverApi.createChannel(serverId, channel.name, channel.type, publicKey);
    setServers(prev => prev.map(s => s.id === serverId ? _updated : s));
  }, [publicKey]);

  const deleteChannel = useCallback(async (serverId: string, channelId: string) => {
    if (!publicKey) return;
    const _updated = await serverApi.deleteChannel(serverId, channelId, publicKey);
    setServers(prev => prev.map(s => s.id === serverId ? _updated : s));
  }, [publicKey]);

  const isOwner = useCallback((serverId: string) => {
    if (!publicKey) return false;
    const _server = servers.find(s => s.id === serverId);
    return _server?.ownerPublicKey === publicKey;
  }, [publicKey, servers]);

  return (
    <ServerContext.Provider value={{
      servers, activeServerId, loading, setActiveServerId,
      createServer, deleteServer, joinServer,
      createChannel, deleteChannel, fetchServers, isOwner,
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
