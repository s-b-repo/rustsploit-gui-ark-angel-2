import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { useRsfHealthStore } from '../stores/rsfHealthStore';

export default function SettingsPage() {
    const { user } = useAuthStore();
    const rsfHealth = useRsfHealthStore();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // TOTP State
    const [totpStep, setTotpStep] = useState<'idle' | 'setup' | 'verify'>('idle');
    const [qrCode, setQrCode] = useState('');
    const [verifyCode, setVerifyCode] = useState('');
    const [totpPassword, setTotpPassword] = useState('');

    const [passwordRules, setPasswordRules] = useState<string[]>([]);

    // RSF API Key state
    const [newApiKey, setNewApiKey] = useState('');
    const [keyPassword, setKeyPassword] = useState('');
    const [updatingKey, setUpdatingKey] = useState(false);

    useEffect(() => {
        apiClient.get('/settings/password/rules')
            .then(res => { if (res.data.success) setPasswordRules(res.data.rules); })
            .catch(() => {
                setPasswordRules([
                    "Minimum 12 characters",
                    "At least one uppercase letter (A-Z)",
                    "At least one lowercase letter (a-z)",
                    "At least one digit (0-9)",
                    "At least one special character (!@#$%^&*…)"
                ]);
            });

        if (user?.role === 'sysadmin') {
            rsfHealth.checkConnection();
        }
    }, []);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await apiClient.put('/settings/password', { currentPassword, newPassword });
            if (res.data.success) {
                toast.success('Password updated successfully');
                setCurrentPassword('');
                setNewPassword('');
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update password');
        }
    };

    const startTotpSetup = async () => {
        try {
            const res = await apiClient.post('/settings/totp/setup');
            if (res.data.success) {
                setQrCode(res.data.qrCode);
                setTotpStep('setup');
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to start setup');
        }
    };

    const verifyTotp = async () => {
        try {
            const res = await apiClient.post('/settings/totp/verify', { code: verifyCode });
            if (res.data.success) {
                toast.success('2FA Enabled Successfully');
                setTotpStep('idle');
                window.location.reload();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Verification failed');
        }
    };

    const disableTotp = async () => {
        if (!confirm('Are you sure you want to disable 2FA? This decreases account security.')) return;
        try {
            const res = await apiClient.delete('/settings/totp', { data: { password: totpPassword } });
            if (res.data.success) {
                toast.success('2FA Disabled');
                setTotpPassword('');
                window.location.reload();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to disable 2FA');
        }
    };

    const handleUpdateApiKey = async () => {
        if (!newApiKey.trim() || !keyPassword) return;
        setUpdatingKey(true);
        try {
            const res = await apiClient.put('/settings/rsf-api-key', {
                apiKey: newApiKey.trim(),
                password: keyPassword,
            });
            if (res.data.success) {
                toast.success(res.data.message);
                setNewApiKey('');
                setKeyPassword('');
                await rsfHealth.checkConnection();
            } else {
                toast.error(res.data.message || 'Failed to update API key');
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update API key');
        } finally {
            setUpdatingKey(false);
        }
    };

    const getStatusColor = () => {
        switch (rsfHealth.status) {
            case 'connected': return 'bg-cyber-green';
            case 'auth_failed': return 'bg-yellow-500';
            case 'blocked': case 'offline': return 'bg-red-500';
            case 'timeout': return 'bg-orange-500';
            case 'degraded': return 'bg-yellow-500';
            default: return 'bg-gray-500';
        }
    };

    const getStatusLabel = () => {
        switch (rsfHealth.status) {
            case 'connected': return 'CONNECTED';
            case 'auth_failed': return 'AUTH FAILED';
            case 'blocked': return 'BLOCKED';
            case 'offline': return 'OFFLINE';
            case 'timeout': return 'TIMEOUT';
            case 'degraded': return 'DEGRADED';
            case 'error': return 'ERROR';
            default: return 'CHECKING…';
        }
    };

    const showKeyRotation = rsfHealth.failureCount >= 3
        || rsfHealth.status === 'auth_failed'
        || rsfHealth.status === 'blocked';

    /* ───────────────────────────────────────── Render ──────── */
    return (
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

            {/* ─── Page Header ───────────────────────────────── */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyber-green/20 to-cyber-blue/10 border border-cyber-green/30 flex items-center justify-center text-lg">
                    ⚙️
                </div>
                <div>
                    <h1 className="text-lg sm:text-xl font-bold text-text-primary tracking-wide">Settings</h1>
                    <p className="text-[0.65rem] text-text-muted uppercase tracking-widest">Account &amp; System Configuration</p>
                </div>
            </div>

            {/* ─── RSF API Connection — sysadmin only ────────── */}
            {user?.role === 'sysadmin' && (
                <section className="glass-card overflow-hidden">
                    {/* Card header bar */}
                    <div className="px-5 sm:px-6 py-4 border-b border-border-dim bg-gradient-to-r from-cyber-blue/5 to-transparent flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <span className="text-base">🔌</span>
                            <h2 className="text-sm font-bold text-text-primary tracking-wide">RSF API Connection</h2>
                        </div>
                        <button
                            onClick={() => rsfHealth.checkConnection()}
                            disabled={rsfHealth.checking}
                            className="btn-secondary text-[0.7rem] px-4 py-1.5 flex items-center gap-1.5 whitespace-nowrap"
                        >
                            {rsfHealth.checking
                                ? <><span className="inline-block animate-spin text-sm">⏳</span> Testing…</>
                                : <><span className="text-sm">🔍</span> Test Connection</>
                            }
                        </button>
                    </div>

                    <div className="px-5 sm:px-6 py-5 space-y-5">
                        {/* Status row */}
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                            {/* Status indicator */}
                            <div className="flex items-center gap-2.5 min-w-[140px]">
                                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getStatusColor()} ${rsfHealth.status === 'connected' ? 'animate-pulse-glow' : 'animate-pulse'}`} />
                                <span className="text-sm font-bold text-text-primary tracking-wider">{getStatusLabel()}</span>
                            </div>
                            {/* Latency */}
                            {rsfHealth.latency !== null && rsfHealth.status === 'connected' && (
                                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                                    <span className="text-cyber-green">⚡</span>
                                    <span>{rsfHealth.latency}ms</span>
                                </div>
                            )}
                            {/* Key preview */}
                            {rsfHealth.keyPreview && (
                                <code className="text-[0.7rem] text-text-muted font-mono bg-bg-input px-2.5 py-1 rounded-md border border-border-dim select-all">
                                    🔑 {rsfHealth.keyPreview}
                                </code>
                            )}
                            {/* Last checked */}
                            {rsfHealth.lastChecked && (
                                <span className="text-[0.6rem] text-text-muted ml-auto">
                                    Last checked {new Date(rsfHealth.lastChecked).toLocaleTimeString()}
                                </span>
                            )}
                        </div>

                        {/* Status message banner */}
                        {rsfHealth.message && (
                            <div className={`text-xs px-4 py-3 rounded-lg border flex items-start gap-2.5 ${rsfHealth.status === 'connected'
                                    ? 'text-cyber-green bg-cyber-green/5 border-cyber-green/20'
                                    : rsfHealth.status === 'auth_failed' || rsfHealth.status === 'blocked'
                                        ? 'text-yellow-400 bg-yellow-500/5 border-yellow-500/20'
                                        : 'text-red-400 bg-red-500/5 border-red-500/20'
                                }`}>
                                <span className="text-sm mt-px shrink-0">
                                    {rsfHealth.status === 'connected' ? '✅' : '⚠️'}
                                </span>
                                <div>
                                    <span>{rsfHealth.message}</span>
                                    {rsfHealth.failureCount > 0 && (
                                        <span className="ml-1.5 opacity-60">
                                            — {rsfHealth.failureCount} consecutive failure{rsfHealth.failureCount !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* API Key Update — shown after repeated failures */}
                        {showKeyRotation && (
                            <div className="pt-5 border-t border-border-dim space-y-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm">🔑</span>
                                    <h3 className="text-xs font-bold text-cyber-blue uppercase tracking-wider">Update RSF API Key</h3>
                                </div>
                                <p className="text-[0.7rem] text-text-muted leading-relaxed max-w-lg">
                                    {rsfHealth.status === 'auth_failed'
                                        ? 'The current API key was rejected by the RSF API. Enter the new key that matches the RSF configuration.'
                                        : rsfHealth.status === 'blocked'
                                            ? 'The API appears to be blocking requests. Update the key if it was recently rotated.'
                                            : 'Multiple connection failures detected. If the RSF API key was rotated, enter the new key below.'}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                                    <div>
                                        <label className="block text-[0.65rem] text-text-secondary mb-1.5 uppercase tracking-wider font-semibold">New API Key</label>
                                        <input
                                            type="password"
                                            value={newApiKey}
                                            onChange={(e) => setNewApiKey(e.target.value)}
                                            className="input-cyber"
                                            placeholder="Paste new RSF API key"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[0.65rem] text-text-secondary mb-1.5 uppercase tracking-wider font-semibold">Your Password</label>
                                        <input
                                            type="password"
                                            value={keyPassword}
                                            onChange={(e) => setKeyPassword(e.target.value)}
                                            className="input-cyber"
                                            placeholder="Confirm sysadmin password"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleUpdateApiKey}
                                    disabled={!newApiKey.trim() || !keyPassword || updatingKey}
                                    className="btn-glow text-xs px-5 py-2.5"
                                >
                                    {updatingKey ? '⏳ Updating…' : '🔑 Update API Key & Test'}
                                </button>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* ─── Two-column grid: Password + 2FA ───────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ─── Password Change ─────────────────────────── */}
                <section className="glass-card overflow-hidden flex flex-col">
                    <div className="px-5 sm:px-6 py-4 border-b border-border-dim bg-gradient-to-r from-cyber-green/5 to-transparent">
                        <div className="flex items-center gap-2.5">
                            <span className="text-base">🔑</span>
                            <h2 className="text-sm font-bold text-text-primary tracking-wide">Change Password</h2>
                        </div>
                    </div>
                    <div className="px-5 sm:px-6 py-5 flex-1 flex flex-col">
                        <form onSubmit={handleChangePassword} className="flex-1 flex flex-col gap-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[0.65rem] text-text-secondary mb-1.5 uppercase tracking-wider font-semibold">Current Password</label>
                                    <input
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="input-cyber"
                                        placeholder="••••••••••"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[0.65rem] text-text-secondary mb-1.5 uppercase tracking-wider font-semibold">New Password</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="input-cyber"
                                        placeholder="••••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Complexity rules */}
                            <div className="bg-bg-input/60 border border-border-dim rounded-lg px-4 py-3">
                                <p className="text-[0.65rem] font-bold text-cyber-blue uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <span className="text-xs">📋</span> Complexity Rules
                                </p>
                                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[0.68rem] text-text-muted list-none">
                                    {passwordRules.map((r, i) => (
                                        <li key={i} className="flex items-start gap-1.5">
                                            <span className="text-cyber-green/60 mt-px shrink-0">›</span>
                                            <span>{r}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="mt-auto pt-1">
                                <button type="submit" className="btn-glow w-full sm:w-auto text-xs px-6 py-2.5">
                                    Update Password
                                </button>
                            </div>
                        </form>
                    </div>
                </section>

                {/* ─── Two-Factor Authentication ──────────────── */}
                <section className="glass-card overflow-hidden flex flex-col">
                    <div className="px-5 sm:px-6 py-4 border-b border-border-dim bg-gradient-to-r from-cyber-blue/5 to-transparent">
                        <div className="flex items-center gap-2.5">
                            <span className="text-base">🛡️</span>
                            <h2 className="text-sm font-bold text-text-primary tracking-wide">Two-Factor Authentication</h2>
                        </div>
                    </div>
                    <div className="px-5 sm:px-6 py-5 flex-1 flex flex-col">
                        {user?.totp_enabled ? (
                            <div className="flex-1 flex flex-col gap-5">
                                {/* Enabled badge */}
                                <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-cyber-green/5 border border-cyber-green/20">
                                    <span className="text-sm">✅</span>
                                    <span className="text-sm font-semibold text-cyber-green">2FA is currently ENABLED</span>
                                </div>

                                {/* Disable section */}
                                <div className="mt-auto pt-4 border-t border-border-dim space-y-3">
                                    <h3 className="text-[0.65rem] font-bold text-red-400 uppercase tracking-wider">Disable 2FA</h3>
                                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                                        <div className="flex-1">
                                            <label className="block text-[0.65rem] text-text-secondary mb-1.5 uppercase tracking-wider font-semibold">Verify Password</label>
                                            <input
                                                type="password"
                                                value={totpPassword}
                                                onChange={(e) => setTotpPassword(e.target.value)}
                                                className="input-cyber"
                                                placeholder="Enter your password"
                                            />
                                        </div>
                                        <button
                                            onClick={disableTotp}
                                            disabled={!totpPassword}
                                            className="btn-danger px-5 py-2.5 whitespace-nowrap shrink-0"
                                        >
                                            Disable 2FA
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            totpStep === 'idle' ? (
                                <div className="flex-1 flex flex-col">
                                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-bg-input/60 border border-border-dim text-text-muted mb-5">
                                        <span className="text-sm shrink-0">ℹ️</span>
                                        <span className="text-[0.75rem] leading-relaxed">
                                            2FA is currently <span className="font-semibold text-yellow-400">DISABLED</span>. Enable it for better security.
                                        </span>
                                    </div>
                                    <div className="mt-auto">
                                        <button onClick={startTotpSetup} className="btn-glow w-full sm:w-auto text-xs px-6 py-2.5">
                                            Enable 2FA
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    <div className="flex flex-col md:flex-row gap-6 bg-bg-input/60 p-5 rounded-xl border border-border-dim">
                                        <div className="bg-white p-2 rounded-lg w-fit h-fit shrink-0 mx-auto md:mx-0">
                                            <img src={qrCode} alt="2FA QR Code" className="w-36 h-36 sm:w-40 sm:h-40" />
                                        </div>
                                        <div className="space-y-4 flex-1 min-w-0">
                                            <div>
                                                <p className="text-sm font-bold text-text-primary mb-1">1. Scan QR Code</p>
                                                <p className="text-[0.7rem] text-text-muted leading-relaxed">Open your authenticator app (Google Authenticator, Authy, etc.) and scan the code.</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-text-primary mb-2">2. Enter Verification Code</p>
                                                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                                                    <input
                                                        type="text"
                                                        placeholder="000000"
                                                        maxLength={6}
                                                        value={verifyCode}
                                                        onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                        className="input-cyber w-full sm:w-32 text-center tracking-[0.3em] text-lg font-mono"
                                                    />
                                                    <button onClick={verifyTotp} disabled={verifyCode.length !== 6} className="btn-glow text-xs px-5 py-2.5 whitespace-nowrap">
                                                        Verify &amp; Enable
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="pt-1">
                                                <button
                                                    onClick={() => setTotpStep('idle')}
                                                    className="text-xs text-text-muted hover:text-cyber-red underline underline-offset-2 bg-transparent border-0 cursor-pointer p-0 transition-colors"
                                                >
                                                    Cancel Setup
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
