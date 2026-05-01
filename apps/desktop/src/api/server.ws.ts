import { rpc } from '../lib/signalingTransport';
import { UserSummary } from '../models/auth/serverAuth.model';
import ChatMessage from '../models/chat/chatMessage.model';

/** Server-members listing over WS RPC (replaces `GET /api/servers/:id/members`). */
export const listServerMembers = (serverId: string): Promise<UserSummary[]> =>
    rpc<UserSummary[]>('server.members', { serverId });

/** Channel chat history over WS RPC (replaces `GET …/messages`). */
export const fetchChannelMessages = (channelId: string): Promise<ChatMessage[]> =>
    rpc<ChatMessage[]>('chat.history', { channelId });

