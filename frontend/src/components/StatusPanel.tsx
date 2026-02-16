import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

interface StatusData {
    uptime: number;
    version: string;
    security: {
        hardened: boolean;
        totp_required: boolean;
        rate_limiting: boolean;
        ip_tracking: boolean;
    };
    resources: {
        memory_used: number;
        cpu_usage: number;
        active_connections: number;
    };
    tracked_ips: any[];
    current_api_key_hash: string;
}

export default function StatusPanel() {
    const [status, setStatus] = useState<StatusData | null>(null);
    const [loading, setLoading] = useState(true);
    const [apiConnected, setApiConnected] = useState<'connected' | 'disconnected' | 'checking'>('checking');

    // Key rotation flow
    const [showRotateConfirm, setShowRotateConfirm] = useState(false);
    const [showVerification, setShowVerification] = useState(false);
    const [verifyPassword, setVerifyPassword] = useState('');
    const [verifyTotp, setVerifyTotp] = useState('');
    const [rotating, setRotating] = useState(false);
    const { user } = useAuthStore();

    const fetchStatus = async () => {
        try {
            const res = await apiClient.get('/rsf/status');
            if (res.data.success) {
                setStatus(res.data.data);
                setApiConnected('connected');
            } else {
                setApiConnected('disconnected');
            }
        } catch (err: any) {
            setApiConnected('disconnected');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    // Step 1: Confirmation prompt
    const handleRotateKeyClick = () => {
        setShowRotateConfirm(true);
    };

    // Step 2: After "Yes" confirmation, show verification
    const handleConfirm = () => {
        setShowRotateConfirm(false);
        setShowVerification(true);
        setVerifyPassword('');
        setVerifyTotp('');
    };

    // Step 3: Verify credentials and rotate
    const handleVerifyAndRotate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!verifyPassword) {
            toast.error('Password is required');
            return;
        }
        setRotating(true);

        try {
            // First verify the user's credentials
            const verifyRes = await apiClient.post('/auth/login', {
                username: user?.username,
                password: verifyPassword,
            });

            // If TOTP is required, verify that too
            if (verifyRes.data.requireTotp) {
                if (!verifyTotp) {
                    toast.error('TOTP code is required');
                    setRotating(false);
                    return;
                }
                // Verify TOTP
                const totpRes = await apiClient.post('/auth/verify-totp', {
                    tempToken: verifyRes.data.tempToken,
                    code: verifyTotp,
                });
                if (!totpRes.data.success) {
                    toast.error('Invalid TOTP code');
                    setRotating(false);
                    return;
                }
            } else if (!verifyRes.data.success && !verifyRes.data.requireTotp) {
                toast.error('Invalid password');
                setRotating(false);
                return;
            }

            // Credentials verified — now rotate the key
            const rotateRes = await apiClient.post('/rsf/rotate-key');
            if (rotateRes.data.success) {
                toast.success('API key rotated successfully');
                setShowVerification(false);
                setVerifyPassword('');
                setVerifyTotp('');
                fetchStatus();
            } else {
                toast.error(rotateRes.data.message || 'Failed to rotate key');
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Verification failed');
        } finally {
            setRotating(false);
        }
    };

    const formatUptime = (seconds: number): string => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}h ${m}m ${s}s`;
    };

    if (loading) {
        return (
            <div className="glass-card p-8 text-center">
                <p className="text-text-muted text-sm">Loading system status...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Connection Status */}
            <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-text-primary">RSF API Connection</h3>
                    <div className="flex items-center gap-2">
                        <div className={apiConnected === 'connected' ? 'status-dot-green' : apiConnected === 'disconnected' ? 'status-dot-red' : 'status-dot-yellow'} />
                        <span className={`text-xs font-medium ${apiConnected === 'connected' ? 'text-cyber-green' : apiConnected === 'disconnected' ? 'text-cyber-red' : 'text-cyber-yellow'}`}>
                            {apiConnected === 'connected' ? 'Connected' : apiConnected === 'disconnected' ? 'Disconnected' : 'Checking...'}
                        </span>
                    </div>
                </div>
                {status && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-bg-input rounded-lg p-3 border border-border-dim">
                            <div className="text-[0.6rem] text-text-muted uppercase tracking-wider">Uptime</div>
                            <div className="text-sm text-text-primary font-mono mt-1">{formatUptime(status.uptime)}</div>
                        </div>
                        <div className="bg-bg-input rounded-lg p-3 border border-border-dim">
                            <div className="text-[0.6rem] text-text-muted uppercase tracking-wider">Version</div>
                            <div className="text-sm text-text-primary font-mono mt-1">{status.version || '—'}</div>
                        </div>
                        <div className="bg-bg-input rounded-lg p-3 border border-border-dim">
                            <div className="text-[0.6rem] text-text-muted uppercase tracking-wider">Memory</div>
                            <div className="text-sm text-text-primary font-mono mt-1">{status.resources?.memory_used || '—'} MB</div>
                        </div>
                        <div className="bg-bg-input rounded-lg p-3 border border-border-dim">
                            <div className="text-[0.6rem] text-text-muted uppercase tracking-wider">Connections</div>
                            <div className="text-sm text-text-primary font-mono mt-1">{status.resources?.active_connections ?? '—'}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Security Status */}
            {status?.security && (
                <div className="glass-card p-4">
                    <h3 className="text-sm font-bold text-text-primary mb-3">Security Hardening</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Hardened', value: status.security.hardened },
                            { label: 'TOTP Required', value: status.security.totp_required },
                            { label: 'Rate Limiting', value: status.security.rate_limiting },
                            { label: 'IP Tracking', value: status.security.ip_tracking },
                        ].map(item => (
                            <div key={item.label} className="flex items-center gap-2 bg-bg-input rounded-lg p-3 border border-border-dim">
                                <span className={item.value ? 'text-cyber-green' : 'text-text-muted'}>
                                    {item.value ? '✓' : '✗'}
                                </span>
                                <span className="text-xs text-text-secondary">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* API Key Management */}
            <div className="glass-card p-4">
                <h3 className="text-sm font-bold text-text-primary mb-3">API Key Management</h3>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-text-muted">
                            Current key hash: <code className="text-text-secondary bg-bg-input px-1 rounded">{status?.current_api_key_hash?.substring(0, 16) || '—'}...</code>
                        </p>
                    </div>
                    <button
                        onClick={handleRotateKeyClick}
                        className="btn-danger text-xs"
                    >
                        🔄 Rotate API Key
                    </button>
                </div>
            </div>

            {/* Tracked IPs */}
            {status?.tracked_ips && status.tracked_ips.length > 0 && (
                <div className="glass-card p-4">
                    <h3 className="text-sm font-bold text-text-primary mb-3">Tracked IPs</h3>
                    <div className="space-y-1">
                        {status.tracked_ips.slice(0, 10).map((ip: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-xs bg-bg-input rounded px-3 py-2 border border-border-dim">
                                <span className="text-text-primary font-mono">{ip.ip}</span>
                                <span className="text-text-muted">{ip.request_count} requests</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showRotateConfirm && (
                <div className="modal-overlay">
                    <div className="glass-card w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold text-cyber-red mb-3">⚠️ Rotate API Key?</h3>
                        <p className="text-xs text-text-secondary mb-4 leading-relaxed">
                            This will invalidate the current API key immediately. All existing sessions using the old key
                            will be disconnected. You will need to update the key in all connected services.
                        </p>
                        <p className="text-xs text-text-muted mb-6">
                            You will be asked to verify your identity before proceeding.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowRotateConfirm(false)}
                                className="flex-1 py-2 rounded-lg border border-border-dim text-text-secondary hover:bg-bg-card-hover transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-1 btn-danger py-2"
                            >
                                Yes, Rotate Key
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Verification Modal */}
            {showVerification && (
                <div className="modal-overlay">
                    <div className="glass-card w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold text-text-primary mb-4">🔐 Verify Identity</h3>
                        <p className="text-xs text-text-muted mb-4">
                            Enter your credentials to authorize the API key rotation.
                        </p>
                        <form onSubmit={handleVerifyAndRotate} className="space-y-3">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Password *</label>
                                <input
                                    type="password"
                                    value={verifyPassword}
                                    onChange={(e) => setVerifyPassword(e.target.value)}
                                    className="input-cyber"
                                    placeholder="Enter your password"
                                    required
                                    autoFocus
                                />
                            </div>
                            {user?.totp_enabled && (
                                <div>
                                    <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">TOTP Code *</label>
                                    <input
                                        type="text"
                                        value={verifyTotp}
                                        onChange={(e) => setVerifyTotp(e.target.value)}
                                        className="input-cyber"
                                        placeholder="6-digit code from authenticator"
                                        maxLength={6}
                                        pattern="[0-9]{6}"
                                    />
                                </div>
                            )}
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => { setShowVerification(false); setVerifyPassword(''); setVerifyTotp(''); }}
                                    className="flex-1 py-2 rounded-lg border border-border-dim text-text-secondary hover:bg-bg-card-hover transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={rotating}
                                    className="flex-1 btn-danger py-2"
                                >
                                    {rotating ? '⟳ Verifying...' : '🔄 Rotate Key'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
