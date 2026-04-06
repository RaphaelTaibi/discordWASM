import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AuthState } from '../models/authState.model';
import Identity from '../models/identity.model';
import { formatUserTag } from '../lib/format-user-tag';
import { mapIdentity } from '../lib/map-identity';

const AuthContext = createContext<AuthState | undefined>(undefined);

/**
 * Authentication provider backed by Ed25519 keypairs stored in a local JSON via Tauri.
 * On mount, attempts to restore the last session from localStorage (public key reference only).
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [identity, setIdentity] = useState<Identity | null>(null);

    // Restore session on mount from last known public key
    useEffect(() => {
        const _lastKey = localStorage.getItem('last_public_key');
        if (_lastKey) {
            invoke('find_identity_by_pubkey', { publicKey: _lastKey })
                .then((raw) => setIdentity(mapIdentity(raw)))
                .catch(() => localStorage.removeItem('last_public_key'));
        }
    }, []);

    /** Creates a new Ed25519 identity with the given pseudo and password. */
    const login = useCallback(async (pseudo: string, password: string) => {
        const _raw = await invoke('create_identity', { pseudo, password });
        const _identity = mapIdentity(_raw);
        localStorage.setItem('last_public_key', _identity.publicKey ?? ((_raw as any).public_key));
        setIdentity(_identity);
    }, []);

    /** Recovers an existing identity by pseudo + password. */
    const recover = useCallback(async (pseudo: string, password: string) => {
        const _raw = await invoke('recover_identity', { pseudo, password });
        const _identity = mapIdentity(_raw);
        localStorage.setItem('last_public_key', _identity.publicKey ?? ((_raw as any).public_key));
        setIdentity(_identity);
    }, []);

    /** Updates the pseudo for the current identity. */
    const updateUsername = useCallback(async (newName: string) => {
        if (!identity) return;
        const _pk = identity.publicKey ?? (identity as any).public_key;
        const _raw = await invoke('update_identity_pseudo', {
            publicKey: _pk,
            newPseudo: newName,
        });
        setIdentity(mapIdentity(_raw));
    }, [identity]);

    /** Updates or removes the avatar for the current identity. */
    const updateAvatar = useCallback(async (avatarData: string | null) => {
        if (!identity) return;
        const _pk = identity.publicKey ?? (identity as any).public_key;
        const _raw = await invoke('update_identity_avatar', {
            publicKey: _pk,
            avatarData,
        });
        setIdentity(mapIdentity(_raw));
    }, [identity]);

    const logout = useCallback(() => {
        localStorage.removeItem('last_public_key');
        setIdentity(null);
    }, []);

    /** Reads publicKey from identity regardless of snake_case or camelCase. */
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
