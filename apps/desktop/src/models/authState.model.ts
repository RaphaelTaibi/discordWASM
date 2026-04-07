import Identity from './identity.model';

export interface AuthState {
    identity: Identity | null;
    username: string | null;
    userId: string | null;
    publicKey: string | null;
    avatar: string | null;
    userTag: string | null;
    /** Server-side user id (UUID) from the auth API. */
    serverUserId: string | null;
    /** JWT token for authenticated API calls. */
    token: string | null;
    isAuthenticated: boolean;
    login: (pseudo: string, password: string) => Promise<void>;
    recover: (pseudo: string, password: string) => Promise<void>;
    logout: () => void;
    updateUsername: (newName: string) => Promise<void>;
    updateAvatar: (avatarData: string | null) => Promise<void>;
}
