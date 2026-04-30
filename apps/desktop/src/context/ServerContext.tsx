import { createContext, useCallback, useContext, useEffect, useState, PropsWithChildren } from 'react';
import { Server, ServerChannel } from '../models/server/server.model';
import ServerContextProps from '../models/server/serverContext.model';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import * as serverApi from '../api/server.api';

const ServerContext = createContext<ServerContextProps | undefined>(undefined);

export const ServerProvider = ({ children }: PropsWithChildren) => {
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { publicKey, token } = useAuth();
  const { addToast } = useToast();

  const fetchServers = useCallback(async () => {
    if (!token || !publicKey) {
      setServers([]);
      return;
    }
    setLoading(true);
    try {
      const _list = await serverApi.listServers();
      setServers(_list);
    } catch (err) {
      console.error('[ServerContext] fetchServers failed:', err);
    } finally {
      setLoading(false);
    }
  }, [token, publicKey]);

  useEffect(() => { fetchServers(); }, [fetchServers]);

  // Lightweight realtime substitute: poll the server list every 10s and on
  // window focus until the signaling server publishes dedicated WS events
  // for `server.created` / `member.joined` / `member.left`.
  useEffect(() => {
    if (!token || !publicKey) return;
    const _interval = setInterval(fetchServers, 10_000);
    const _onFocus = () => { fetchServers(); };
    const _onVisible = () => { if (document.visibilityState === 'visible') fetchServers(); };
    window.addEventListener('focus', _onFocus);
    document.addEventListener('visibilitychange', _onVisible);
    return () => {
      clearInterval(_interval);
      window.removeEventListener('focus', _onFocus);
      document.removeEventListener('visibilitychange', _onVisible);
    };
  }, [token, publicKey, fetchServers]);

  useEffect(() => {
    if (!token || !publicKey) {
      setServers([]);
      setActiveServerId(null);
    }
  }, [token, publicKey]);

  const createServer = useCallback(async (name: string) => {
    if (!publicKey) return;
    try {
      const _server = await serverApi.createServer(name, publicKey);
      setServers(prev => [...prev, _server]);
      setActiveServerId(_server.id);
    } catch (err) {
      console.error('Failed to create server:', err);
      addToast(`Erreur création serveur : ${(err as Error).message}`, 'error');
    }
  }, [publicKey, addToast]);

  const deleteServer = useCallback(async (serverId: string) => {
    if (!publicKey) return;
    try {
      await serverApi.deleteServer(serverId, publicKey);
      setServers(prev => prev.filter(s => s.id !== serverId));
      if (activeServerId === serverId) setActiveServerId(null);
      addToast('Serveur supprimé', 'success');
    } catch (err) {
      console.error('[ServerContext] deleteServer failed:', err);
      addToast(`Erreur suppression serveur : ${(err as Error).message}`, 'error');
    }
  }, [publicKey, activeServerId, addToast]);

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
    if (!publicKey) {
      addToast('Impossible de créer le salon : identité non disponible.', 'error');
      return;
    }
    try {
      const _updated = await serverApi.createChannel(serverId, channel.name, channel.type, publicKey);
      setServers(prev => prev.map(s => s.id === serverId ? _updated : s));
      addToast(`Salon « ${channel.name} » créé`, 'success');
    } catch (err) {
      console.error('Failed to create channel:', err);
      addToast(`Erreur création salon : ${(err as Error).message}`, 'error');
    }
  }, [publicKey, addToast]);

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
