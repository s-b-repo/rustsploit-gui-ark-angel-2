import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { useRsfHealthStore } from '../stores/rsfHealthStore';

const apiClient = axios.create({
    baseURL: '/api',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add JWT token to all requests
apiClient.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auto-redirect on 401, track RSF health on proxy responses
apiClient.interceptors.response.use(
    (response) => {
        // Track successful RSF proxy calls
        const url = response.config.url || '';
        if (url.startsWith('/rsf/')) {
            useRsfHealthStore.getState().recordProxySuccess();
        }
        return response;
    },
    (error) => {
        if (error.response?.status === 401) {
            const store = useAuthStore.getState();
            // Only auto-logout for non-settings calls (settings 401 = bad password)
            const url = error.config?.url || '';
            if (store.isAuthenticated && !url.includes('/settings/')) {
                store.logout();
            }
        }

        // Track RSF proxy failures (502 = offline, 401/403 on /rsf/ = auth issue)
        const url = error.config?.url || '';
        if (url.startsWith('/rsf/') && error.response) {
            const status = error.response.status;
            if (status === 502 || status === 401 || status === 403 || status === 429 || status >= 500) {
                useRsfHealthStore.getState().recordProxyFailure(
                    status,
                    error.response?.data?.message || `RSF proxy error (${status})`
                );
            }
        }

        return Promise.reject(error);
    }
);

export default apiClient;

