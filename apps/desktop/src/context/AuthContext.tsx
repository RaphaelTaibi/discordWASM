import { createContext, ReactNode, useCallback, useContext, useState, useMemo } from 'react';

interface AuthState {
    username: string | null;
    userId: string | null;
    isAuthenticated: boolean;
    login: (name: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [username, setUsername] = useState<string | null>(
        () => localStorage.getItem('emergency_user')
    );

    // Générer un userId stable basé sur le pseudo ou un ID aléatoire persistant
    const userId = useMemo(() => {
        if (!username) return null;
        let id = localStorage.getItem(`user_id_${username}`);
        if (!id) {
            id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            localStorage.setItem(`user_id_${username}`, id);
        }
        return id;
    }, [username]);

    const login = useCallback((name: string) => {
        localStorage.setItem('emergency_user', name);
        setUsername(name);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('emergency_user');
        setUsername(null);
    }, []);

    return (
        <AuthContext.Provider value={{ username, userId, isAuthenticated: !!username, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
