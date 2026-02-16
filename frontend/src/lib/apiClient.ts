import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

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

// Auto-redirect on 401
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const store = useAuthStore.getState();
            if (store.isAuthenticated) {
                store.logout();
                // ProtectedRoute in App.tsx will redirect to /login
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;
