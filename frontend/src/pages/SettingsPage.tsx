import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';

export default function SettingsPage() {
    const { user } = useAuthStore();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // TOTP State
    const [totpStep, setTotpStep] = useState<'idle' | 'setup' | 'verify'>('idle');
    const [qrCode, setQrCode] = useState('');
    const [verifyCode, setVerifyCode] = useState('');
    const [totpPassword, setTotpPassword] = useState(''); // for disabling

    const [passwordRules, setPasswordRules] = useState<string[]>([]);

    useEffect(() => {
        apiClient.get('/settings/password/rules')
            .then(res => { if (res.data.success) setPasswordRules(res.data.rules); })
            .catch(() => {
                // Fallback defaults if fetch fails
                setPasswordRules([
                    "At least 12 characters",
                    "At least one uppercase letter",
                    "At least one lowercase letter",
                    "At least one number",
                    "At least one special character"
                ]);
            });
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
                // secret is also returned but mainly needed for QR or manual entry if we implemented that
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

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <span className="text-cyber-green">⚙️</span> User Settings
            </h1>

            {/* Password Change */}
            <div className="glass-card p-6">
                <h2 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                    <span className="text-cyber-green">🔑</span> Change Password
                </h2>
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                    <div>
                        <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Current Password</label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="input-cyber"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">New Password</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="input-cyber"
                            required
                        />
                    </div>
                    <div className="text-xs text-text-muted bg-bg-input p-3 rounded-lg border border-border-dim">
                        <p className="font-semibold mb-1 text-cyber-blue">Complexity Rules:</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                            {passwordRules.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                    </div>
                    <button type="submit" className="btn-glow">Update Password</button>
                </form>
            </div>

            {/* 2FA Settings */}
            <div className="glass-card p-6">
                <h2 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                    <span className="text-cyber-blue">🛡️</span> Two-Factor Authentication
                </h2>

                {user?.totp_enabled ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-cyber-green bg-cyber-green/10 p-3 rounded-lg border border-cyber-green/30">
                            <span>✅</span>
                            <span className="font-semibold text-sm">2FA is currently ENABLED</span>
                        </div>

                        <div className="pt-4 border-t border-border-dim">
                            <h3 className="text-xs font-bold text-text-secondary uppercase mb-3 text-cyber-red">Disable 2FA</h3>
                            <div className="flex gap-3 max-w-md items-end">
                                <div className="flex-1">
                                    <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Verify Password</label>
                                    <input
                                        type="password"
                                        value={totpPassword}
                                        onChange={(e) => setTotpPassword(e.target.value)}
                                        className="input-cyber"
                                    />
                                </div>
                                <button
                                    onClick={disableTotp}
                                    disabled={!totpPassword}
                                    className="btn-danger h-[38px] whitespace-nowrap"
                                >
                                    Disable 2FA
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Setup Flow
                    totpStep === 'idle' ? (
                        <div>
                            <div className="flex items-center gap-2 text-text-muted bg-bg-input p-3 rounded-lg border border-border-dim mb-4">
                                <span>ℹ️</span>
                                <span className="text-sm">2FA is currently DISABLED. Enable it for better security.</span>
                            </div>
                            <button onClick={startTotpSetup} className="btn-glow">Enable 2FA</button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row gap-8 bg-bg-input p-6 rounded-xl border border-border-dim">
                                <div className="bg-white p-2 rounded-lg w-fit h-fit">
                                    <img src={qrCode} alt="2FA QR Code" className="w-40 h-40" />
                                </div>
                                <div className="space-y-4 flex-1">
                                    <div>
                                        <p className="text-sm font-bold text-text-primary mb-1">1. Scan QR Code</p>
                                        <p className="text-xs text-text-muted">Open your authenticator app (Google Authenticator, Authy, etc.) and scan the code.</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-text-primary mb-1">2. Enter Verification Code</p>
                                        <div className="flex gap-3 items-center">
                                            <input
                                                type="text"
                                                placeholder="000000"
                                                maxLength={6}
                                                value={verifyCode}
                                                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                className="input-cyber w-32 text-center tracking-widest text-lg font-mono"
                                            />
                                            <button onClick={verifyTotp} disabled={verifyCode.length !== 6} className="btn-glow">
                                                Verify & Enable
                                            </button>
                                        </div>
                                    </div>
                                    <div className="pt-2">
                                        <button
                                            onClick={() => setTotpStep('idle')}
                                            className="text-xs text-text-muted hover:text-text-primary underline bg-transparent border-0 cursor-pointer p-0"
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
        </div>
    );
}
