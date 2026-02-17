import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';
import toast from 'react-hot-toast';

export default function TargetPanel() {
    const [target, setTarget] = useState('');
    const [currentTarget, setCurrentTarget] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [setting, setSetting] = useState(false);
    const [honeypotResult, setHoneypotResult] = useState<any | null>(null);
    const [checkingHoneypot, setCheckingHoneypot] = useState(false);

    useEffect(() => {
        fetchTarget();
    }, []);

    const fetchTarget = async () => {
        try {
            const res = await apiClient.get('/rsf/target');
            if (res.data.success && res.data.data?.target) {
                setCurrentTarget(res.data.data.target);
                setTarget(res.data.data.target);
            }
        } catch {
            // Target may not be set
        } finally {
            setLoading(false);
        }
    };

    const handleSetTarget = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!target.trim()) return;
        setSetting(true);
        try {
            const res = await apiClient.post('/rsf/target', { target: target.trim() });
            if (res.data.success) {
                setCurrentTarget(target.trim());
                toast.success(`Target set to ${target.trim()}`);
            } else {
                toast.error(res.data.message || 'Failed to set target');
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to set target');
        } finally {
            setSetting(false);
        }
    };

    const handleHoneypotCheck = async () => {
        if (!currentTarget) return;
        setCheckingHoneypot(true);
        setHoneypotResult(null);
        try {
            const res = await apiClient.get(`/rsf/honeypot/${currentTarget}`);
            if (res.data.success) {
                setHoneypotResult(res.data.data);
            } else {
                toast.error('Honeypot check failed');
            }
        } catch {
            toast.error('Honeypot check failed');
        } finally {
            setCheckingHoneypot(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-text-muted text-xs animate-pulse">Loading target...</div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Set Target Card */}
            <div className="glass-card overflow-hidden">
                <div className="card-header card-header-green">
                    <div className="flex items-center gap-2">
                        <div className="icon-badge" style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', fontSize: '1rem' }}>🎯</div>
                        <h2 className="text-sm font-bold text-text-primary">Global Target</h2>
                    </div>
                    {currentTarget && (
                        <span className="badge badge-green text-[0.6rem]">SET</span>
                    )}
                </div>

                <div className="p-5">
                    {/* Current target display */}
                    {currentTarget && (
                        <div className="mb-5 p-4 bg-bg-input rounded-xl border border-border-glow relative overflow-hidden">
                            <div className="text-[0.6rem] text-text-muted uppercase tracking-wider mb-1.5 font-semibold">Current Target</div>
                            <div className="text-lg font-bold text-cyber-green font-mono tracking-wider">
                                {currentTarget}
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSetTarget} className="space-y-4">
                        <div>
                            <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider font-semibold">
                                Set New Target
                            </label>
                            <input
                                type="text"
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                className="input-cyber text-base"
                                placeholder="IP, Hostname, or CIDR (e.g. 192.168.1.0/24)"
                            />
                        </div>
                        <button type="submit" disabled={setting || !target.trim()} className="btn-glow w-full">
                            {setting ? '⟳ Setting...' : '🎯 Set Target'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Honeypot Check Card */}
            {currentTarget && (
                <div className="glass-card overflow-hidden">
                    <div className="card-header card-header-yellow">
                        <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                            <span className="text-cyber-yellow">🍯</span> Honeypot Check
                        </h2>
                    </div>
                    <div className="p-5">
                        <p className="text-xs text-text-muted mb-4 leading-relaxed">
                            Check if the current target ({currentTarget}) is a known honeypot by analyzing open ports, service banners, and behavioral fingerprints.
                        </p>

                        <button
                            onClick={handleHoneypotCheck}
                            disabled={checkingHoneypot}
                            className="btn-secondary w-full"
                        >
                            {checkingHoneypot ? (
                                <span className="animate-pulse">🔍 Analyzing target...</span>
                            ) : (
                                '🍯 Run Honeypot Detection'
                            )}
                        </button>

                        {honeypotResult && (
                            <div className="mt-4 space-y-3">
                                <div className={`stat-card ${honeypotResult.is_honeypot ? 'stat-card-red' : 'stat-card-green'} text-center`}>
                                    <div className="text-2xl mb-1">{honeypotResult.is_honeypot ? '🚨' : '✅'}</div>
                                    <div className={`text-sm font-bold ${honeypotResult.is_honeypot ? 'text-cyber-red' : 'text-cyber-green'}`}>
                                        {honeypotResult.is_honeypot ? 'Honeypot Detected' : 'No Honeypot Indicators'}
                                    </div>
                                    {honeypotResult.confidence && (
                                        <div className="text-text-muted text-xs mt-1">
                                            Confidence: {honeypotResult.confidence}%
                                        </div>
                                    )}
                                </div>
                                {honeypotResult.details && (
                                    <div className="terminal-output text-[0.65rem] max-h-[200px] overflow-y-auto">
                                        {honeypotResult.details}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
