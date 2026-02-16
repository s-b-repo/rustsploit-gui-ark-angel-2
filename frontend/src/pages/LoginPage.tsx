import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import apiClient from '../lib/apiClient';
import toast from 'react-hot-toast';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [totpCode, setTotpCode] = useState('');
    const [tempToken, setTempToken] = useState('');
    const [showTotp, setShowTotp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [matrixChars, setMatrixChars] = useState<string[]>([]);
    const navigate = useNavigate();
    const { setAuth, isAuthenticated } = useAuthStore();
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isAuthenticated) navigate('/', { replace: true });
    }, [isAuthenticated, navigate]);

    // Matrix rain effect
    useEffect(() => {
        const chars = 'ラドクリフマリスムネットワークセキュリティABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';
        const columns = Math.floor(window.innerWidth / 20);
        const rain: string[] = [];
        for (let i = 0; i < columns; i++) {
            let col = '';
            for (let j = 0; j < 30; j++) {
                col += chars[Math.floor(Math.random() * chars.length)];
            }
            rain.push(col);
        }
        setMatrixChars(rain);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await apiClient.post('/auth/login', { username, password });
            if (res.data.requireTotp) {
                setTempToken(res.data.tempToken);
                setShowTotp(true);
                toast('🔐 Enter your 2FA code', { duration: 3000 });
            } else {
                // Fetch user info with permissions
                const meRes = await apiClient.get('/auth/me', {
                    headers: { Authorization: `Bearer ${res.data.token}` },
                });
                setAuth(
                    {
                        ...meRes.data.user,
                        permissions: meRes.data.user.permissions,
                    },
                    res.data.token
                );
                toast.success('Access granted');
                navigate('/', { replace: true });
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const handleTotp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await apiClient.post('/auth/verify-totp', {
                tempToken,
                code: totpCode,
            });
            const meRes = await apiClient.get('/auth/me', {
                headers: { Authorization: `Bearer ${res.data.token}` },
            });
            setAuth(
                {
                    ...meRes.data.user,
                    permissions: meRes.data.user.permissions,
                },
                res.data.token
            );
            toast.success('Access granted');
            navigate('/', { replace: true });
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Invalid TOTP code');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg-primary flex items-center justify-center relative overflow-hidden">
            {/* Matrix background */}
            <div className="absolute inset-0 overflow-hidden opacity-[0.04] pointer-events-none select-none">
                <div className="flex gap-4 justify-center">
                    {matrixChars.map((col, i) => (
                        <div
                            key={i}
                            className="text-cyber-green text-xs leading-5 font-mono whitespace-pre"
                            style={{
                                animation: `matrix-fall ${8 + Math.random() * 12}s linear infinite`,
                                animationDelay: `${Math.random() * -20}s`,
                            }}
                        >
                            {col.split('').map((c, j) => (
                                <div key={j}>{c}</div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Login card */}
            <div className="glass-card p-8 w-full max-w-md relative z-10">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyber-green/20 to-cyber-green/5 border border-border-glow mb-4">
                        <span className="text-3xl">🛡️</span>
                    </div>
                    <h1 className="text-xl font-bold text-cyber-green tracking-wider">RUSTSPLOIT</h1>
                    <p className="text-xs text-text-muted mt-1 tracking-widest uppercase">Command Center • GUI Access</p>
                </div>

                {/* Animated terminal prompt */}
                <div className="bg-black rounded-lg p-3 mb-6 border border-border-dim">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-cyber-red" />
                        <div className="w-2.5 h-2.5 rounded-full bg-cyber-yellow" />
                        <div className="w-2.5 h-2.5 rounded-full bg-cyber-green" />
                    </div>
                    <div className="text-xs text-cyber-green font-mono">
                        <span className="text-text-muted">root@rustsploit</span>
                        <span className="text-cyber-blue">:</span>
                        <span className="text-cyber-purple">~</span>
                        <span className="text-text-primary">$ </span>
                        <span className="cursor-blink">{showTotp ? 'verify --2fa' : 'authenticate --user'}</span>
                    </div>
                </div>

                {!showTotp ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Username</label>
                            <input
                                ref={inputRef}
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="input-cyber"
                                placeholder="Enter username"
                                autoFocus
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-cyber"
                                placeholder="Enter password"
                                required
                            />
                        </div>
                        <button type="submit" disabled={loading} className="btn-glow w-full mt-2">
                            {loading ? '◌ Authenticating...' : '▸ Authenticate'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleTotp} className="space-y-4">
                        <div className="text-center mb-2">
                            <div className="badge badge-blue mb-2">2FA Required</div>
                            <p className="text-xs text-text-secondary">Enter the 6-digit code from your authenticator app</p>
                        </div>
                        <div>
                            <input
                                type="text"
                                value={totpCode}
                                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="input-cyber text-center text-2xl tracking-[0.5em]"
                                placeholder="000000"
                                maxLength={6}
                                autoFocus
                                required
                            />
                        </div>
                        <button type="submit" disabled={loading || totpCode.length !== 6} className="btn-glow w-full">
                            {loading ? '◌ Verifying...' : '▸ Verify Code'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowTotp(false);
                                setTotpCode('');
                                setTempToken('');
                            }}
                            className="w-full text-xs text-text-muted hover:text-text-secondary transition-colors bg-transparent border-0 cursor-pointer py-2"
                        >
                            ← Back to login
                        </button>
                    </form>
                )}

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-border-dim text-center">
                    <p className="text-[0.6rem] text-text-muted tracking-wider">
                        AUTHORIZED ACCESS ONLY • ALL ACTIVITIES MONITORED
                    </p>
                </div>
            </div>
        </div>
    );
}
