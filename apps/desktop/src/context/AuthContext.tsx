import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AuthState } from '../models/authState.model';
import Identity from '../models/identity.model';
import { formatUserTag } from '../lib/format-user-tag';
import { mapIdentity } from '../lib/map-identity';
import { registerAccount, loginAccount, getMe, updateMe } from '../api/auth.api';
import { getToken, setToken, clearToken } from '../api/http-client';

const AuthContext = createContext<AuthState | undefined>(undefined);

/**
 * Authentication provider combining local Ed25519 identity (Tauri) with
 * server-side auth (JWT + protobuf store on signaling server).
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [identity, setIdentity] = useState<Identity | null>(null);
    const [serverUserId, setServerUserId] = useState<string | null>(null);
    const [token, setTokenState] = useState<string | null>(getToken());

    // Restore session on mount
    useEffect(() => {
        const _lastKey = localStorage.getItem('last_public_key');
        if (_lastKey) {
            invoke('find_identity_by_pubkey', { publicKey: _lastKey })
                .then((raw) => setIdentity(mapIdentity(raw)))
                .catch(() => localStorage.removeItem('last_public_key'));
        }
        // Restore server session from stored JWT
        if (getToken()) {
            getMe()
                .then((profile) => setServerUserId(profile.id))
                .catch(() => { clearToken(); setTokenState(null); });
        }
    }, []);

    /** Creates a new Ed25519 identity locally + registers on server. */
    const login = useCallback(async (pseudo: string, password: string) => {
        const _raw = await invoke('create_identity', { pseudo, password });
        const _identity = mapIdentity(_raw);
        localStorage.setItem('last_public_key', _identity.publicKey ?? ((_raw as any).public_key));
        setIdentity(_identity);

        try {
            const res = await registerAccount(pseudo, password, pseudo, _identity.publicKey);
            setToken(res.token);
            setTokenState(res.token);
            setServerUserId(res.user.id);
        } catch {
            // Server registration failed — local identity still works
        }
    }, []);

    /** Recovers local identity + logs in on server. */
    const recover = useCallback(async (pseudo: string, password: string) => {
        const _raw = await invoke('recover_identity', { pseudo, password });
        const _identity = mapIdentity(_raw);
        localStorage.setItem('last_public_key', _identity.publicKey ?? ((_raw as any).public_key));
        setIdentity(_identity);

        try {
            const res = await loginAccount(pseudo, password);
            setToken(res.token);
            setTokenState(res.token);
            setServerUserId(res.user.id);
        } catch {
            // Server login failed — local identity still works
        }
    }, []);

    /** Updates the pseudo for the current identity (local + server). */
    const updateUsername = useCallback(async (newName: string) => {
        if (!identity) return;
        const _pk = identity.publicKey ?? (identity as any).public_key;
        const _raw = await invoke('update_identity_pseudo', {
            publicKey: _pk,
            newPseudo: newName,
        });
        setIdentity(mapIdentity(_raw));

        if (getToken()) {
            try { await updateMe({ displayName: newName }); } catch { /* noop */ }
        }
    }, [identity]);

    /** Updates or removes the avatar (local + server). */
    const updateAvatar = useCallback(async (avatarData: string | null) => {
        if (!identity) return;
        const _pk = identity.publicKey ?? (identity as any).public_key;
        const _raw = await invoke('update_identity_avatar', {
            publicKey: _pk,
            avatarData,
        });
        setIdentity(mapIdentity(_raw));

        if (getToken() && avatarData) {
            try { await updateMe({ avatar: avatarData }); } catch { /* noop */ }
        }
    }, [identity]);

    const logout = useCallback(() => {
        localStorage.removeItem('last_public_key');
        clearToken();
        setIdentity(null);
        setServerUserId(null);
        setTokenState(null);
    }, []);

    const resolvedPublicKey = identity?.publicKey ?? (identity as any)?.public_key ?? null;

    const userTag = useMemo(() => {
        return identity?.pseudo && resolvedPublicKey
            ? formatUserTag(identity.pseudo, resolvedPublicKey)
            : null;
    }, [identity, resolvedPublicKey]);

    return (
        <AuthContext.Provider value={{
            identity,
            username: identity?.pseudo ?? null,
            userId: resolvedPublicKey,
            publicKey: resolvedPublicKey,
            avatar: identity?.avatar ?? null,
            userTag,
            serverUserId,
            token,
            isAuthenticated: !!identity,
            login,
            recover,
            logout,
            updateUsername,
            updateAvatar,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

/**
 * @throws {Error} If called outside of an AuthProvider.
 * @returns {AuthState} The current authentication state.
 */
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
