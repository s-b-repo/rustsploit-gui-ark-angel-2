import { create } from 'zustand';
import apiClient from '../lib/apiClient';

type RsfStatus = 'unknown' | 'connected' | 'auth_failed' | 'degraded' | 'offline' | 'timeout' | 'error' | 'blocked';

interface RsfHealthState {
    /** Current RSF connection status */
    status: RsfStatus;
    /** Human-readable message */
    message: string;
    /** Latency in ms */
    latency: number | null;
    /** Masked API key preview */
    keyPreview: string;
    /** Consecutive failure count */
    failureCount: number;
    /** Timestamp of last check */
    lastChecked: number | null;
    /** Whether a check is in progress */
    checking: boolean;
    /** Whether the degraded banner should be shown */
    showBanner: boolean;
    /** Dismiss the banner (until next failure) */
    dismissBanner: () => void;
    /** Test RSF connection */
    checkConnection: () => Promise<void>;
    /** Record a proxy failure from interceptor */
    recordProxyFailure: (status: number, message: string) => void;
    /** Record a proxy success */
    recordProxySuccess: () => void;
}

export const useRsfHealthStore = create<RsfHealthState>()((set, get) => ({
    status: 'unknown',
    message: '',
    latency: null,
    keyPreview: '',
    failureCount: 0,
    lastChecked: null,
    checking: false,
    showBanner: false,

    dismissBanner: () => set({ showBanner: false }),

    checkConnection: async () => {
        set({ checking: true });
        try {
            const res = await apiClient.get('/settings/rsf-connection');
            if (res.data.success) {
                const isHealthy = res.data.status === 'connected';
                set({
                    status: res.data.status,
                    message: res.data.message,
                    latency: res.data.latency ?? null,
                    keyPreview: res.data.keyPreview ?? '',
                    lastChecked: Date.now(),
                    checking: false,
                    failureCount: isHealthy ? 0 : get().failureCount + 1,
                    showBanner: !isHealthy,
                });
            }
        } catch {
            set({
                status: 'error',
                message: 'Failed to reach GUI backend',
                checking: false,
                failureCount: get().failureCount + 1,
                lastChecked: Date.now(),
                showBanner: true,
            });
        }
    },

    recordProxyFailure: (status: number, message: string) => {
        const count = get().failureCount + 1;
        let newStatus: RsfStatus = 'error';
        if (status === 502) newStatus = 'offline';
        else if (status === 401 || status === 403) newStatus = 'auth_failed';
        else if (status === 429) newStatus = 'blocked';

        set({
            status: newStatus,
            message,
            failureCount: count,
            lastChecked: Date.now(),
            showBanner: count >= 3,
        });
    },

    recordProxySuccess: () => {
        const prev = get();
        // Only update if was previously degraded
        if (prev.status !== 'connected' && prev.status !== 'unknown') {
            set({
                status: 'connected',
                message: 'RSF API is online',
                failureCount: 0,
                showBanner: false,
                lastChecked: Date.now(),
            });
        }
    },
}));
