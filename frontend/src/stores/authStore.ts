import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
    id: number;
    username: string;
    email: string;
    role: 'sysadmin' | 'admin' | 'pentester';
    totp_enabled: boolean;
    permissions: Permissions;
}

export interface Permissions {
    panels: {
        [key: string]: { [action: string]: boolean };
    };
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    setAuth: (user: User, token: string) => void;
    logout: () => void;
    hasPermission: (panel: string, action: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,

            setAuth: (user: User, token: string) => {
                set({ user, token, isAuthenticated: true });
            },

            logout: () => {
                set({ user: null, token: null, isAuthenticated: false });
            },

            hasPermission: (panel: string, action: string) => {
                const { user } = get();
                if (!user) return false;
                if (user.role === 'sysadmin') return true;
                return user.permissions?.panels?.[panel]?.[action] ?? false;
            },
        }),
        {
            name: 'rsf-gui-auth',
        }
    )
);
