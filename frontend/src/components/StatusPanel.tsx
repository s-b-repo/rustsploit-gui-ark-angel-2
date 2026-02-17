import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';
import toast from 'react-hot-toast';

interface StatusData {
    harden_enabled: boolean;
    ip_limit: number;
    unique_ips: number;
    key_created_at: string;
    log_file: string;
    tracked_ips: { ip: string; first_seen: string; last_seen: string; request_count: number }[];
    job_archive: { jobs_in_memory: number; archive_dir: string; max_output_size_mb: number };
    rate_limits: { api_key_limit: number; window_seconds: number };
}

interface ConfigData {
    harden_enabled: boolean;
    harden_totp: boolean;
    harden_rate_limit: boolean;
    harden_ip_tracking: boolean;
    ip_limit: number;
    verbose: boolean;
    rate_limits: { api_key_limit: number; window_seconds: number };
    job_archive: { max_output_size_bytes: number; archive_dir: string };
    log_file: string;
    trusted_proxies: string[];
}

export default function StatusPanel() {
    const [status, setStatus] = useState<StatusData | null>(null);
    const [config, setConfig] = useState<ConfigData | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<'status' | 'config' | 'logs'>('status');

    const fetchAll = async () => {
        try {
            const [statusRes, configRes] = await Promise.allSettled([
                apiClient.get('/rsf/status'),
                apiClient.get('/rsf/config'),
            ]);
            if (statusRes.status === 'fulfilled' && statusRes.value.data.success) {
                setStatus(statusRes.value.data.data);
            }
            if (configRes.status === 'fulfilled' && configRes.value.data.success) {
                setConfig(configRes.value.data.data);
            }
        } catch {
            // Silently handle — panels show empty state
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async () => {
        try {
            const res = await apiClient.get('/rsf/logs?lines=200');
            if (res.data.success) {
                setLogs(res.data.data?.lines || []);
            }
        } catch (err: any) {
            if (err.response?.status !== 404) {
                toast.error('Failed to load logs');
            }
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    useEffect(() => {
        if (activeSection === 'logs') fetchLogs();
    }, [activeSection]);

    const handleRotateKey = async () => {
        if (!confirm('Rotate the API key? The current key will be invalidated.')) return;
        try {
            const res = await apiClient.post('/rsf/rotate-key');
            if (res.data.success) {
                toast.success('API key rotated');
                fetchAll();
            } else {
                toast.error(res.data.message || 'Rotation failed');
            }
        } catch {
            toast.error('Key rotation failed');
        }
    };

    if (loading) {
        return (
            <div className="glass-card p-8 text-center">
                <span className="text-text-muted animate-pulse">Loading status...</span>
            </div>
        );
    }

    const sections = [
        { id: 'status' as const, label: '📊 Status', icon: '📊' },
        { id: 'config' as const, label: '⚙️ Config', icon: '⚙️' },
        { id: 'logs' as const, label: '📜 Audit Log', icon: '📜' },
    ];

    return (
        <div className="glass-card overflow-hidden">
            {/* Gradient header */}
            <div className="card-header card-header-blue">
                <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <span className="text-cyber-blue">📊</span> RSF Status & Configuration
                </h2>
            </div>

            {/* Section Tabs */}
            <div className="flex border-b border-border-dim bg-bg-secondary/40">
                {sections.map((sec) => (
                    <button
                        key={sec.id}
                        onClick={() => setActiveSection(sec.id)}
                        className={`flex-1 p-3 text-xs font-bold uppercase tracking-wider transition-all bg-transparent border-0 cursor-pointer ${activeSection === sec.id
                            ? 'text-cyber-green border-b-2 border-cyber-green shadow-[0_2px_10px_rgba(0,255,65,0.15)]'
                            : 'text-text-muted hover:text-text-secondary'
                            }`}
                    >
                        {sec.label}
                    </button>
                ))}
            </div>

            <div className="p-6">
                {/* ── Status Section ── */}
                {activeSection === 'status' && !status && (
                    <div className="text-center py-8">
                        <div className="text-3xl mb-3 opacity-20">📊</div>
                        <p className="text-text-muted text-xs">Status data unavailable. The RSF API may not be reachable.</p>
                    </div>
                )}

                {activeSection === 'status' && status && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="stat-card stat-card-green text-center">
                                <div className="text-lg mb-1">🛡️</div>
                                <div className={`text-lg font-bold ${status.harden_enabled ? 'text-cyber-green' : 'text-cyber-red'}`}>
                                    {status.harden_enabled ? 'ENABLED' : 'DISABLED'}
                                </div>
                                <div className="text-[0.6rem] text-text-muted uppercase tracking-wider mt-1">Hardening</div>
                            </div>
                            <div className="stat-card stat-card-blue text-center">
                                <div className="text-lg mb-1">🌐</div>
                                <div className="text-lg font-bold text-cyber-blue">{status.unique_ips ?? 0}</div>
                                <div className="text-[0.6rem] text-text-muted uppercase tracking-wider mt-1">Unique IPs</div>
                            </div>
                            <div className="stat-card stat-card-yellow text-center">
                                <div className="text-lg mb-1">📊</div>
                                <div className="text-lg font-bold text-cyber-yellow">{status.ip_limit ?? 0}</div>
                                <div className="text-[0.6rem] text-text-muted uppercase tracking-wider mt-1">IP Limit</div>
                            </div>
                            <div className="stat-card stat-card-purple text-center">
                                <div className="text-lg mb-1">📦</div>
                                <div className="text-lg font-bold text-purple-400">{status.job_archive?.jobs_in_memory ?? 0}</div>
                                <div className="text-[0.6rem] text-text-muted uppercase tracking-wider mt-1">Jobs in Memory</div>
                            </div>
                        </div>

                        {status.rate_limits && (
                            <div className="bg-bg-input rounded-xl p-4 border border-border-dim">
                                <div className="text-xs text-text-muted uppercase tracking-wider mb-2 font-semibold">Rate Limits</div>
                                <div className="text-sm text-text-secondary">
                                    <span className="text-text-primary font-bold">{status.rate_limits.api_key_limit}</span> requests per{' '}
                                    <span className="text-text-primary font-bold">{status.rate_limits.window_seconds}</span> seconds
                                </div>
                            </div>
                        )}

                        <div className="bg-bg-input rounded-xl p-4 border border-border-dim">
                            <div className="text-xs text-text-muted uppercase tracking-wider mb-2 font-semibold">API Key</div>
                            <div className="text-xs text-text-secondary mb-3">
                                Created: <span className="font-mono text-text-primary">{status.key_created_at ? new Date(status.key_created_at).toLocaleString() : '—'}</span>
                            </div>
                            <button onClick={handleRotateKey} className="btn-glow text-xs">
                                🔄 Rotate Key
                            </button>
                        </div>

                        {/* Tracked IPs */}
                        {(status.tracked_ips?.length ?? 0) > 0 && (
                            <div>
                                <div className="text-xs text-text-muted uppercase tracking-wider mb-3 font-semibold">
                                    Tracked IPs <span className="badge badge-blue text-[0.55rem] ml-1">{status.tracked_ips.length}</span>
                                </div>
                                <div className="glass-card overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="table-premium">
                                            <thead>
                                                <tr>
                                                    <th>IP</th>
                                                    <th>Requests</th>
                                                    <th>First Seen</th>
                                                    <th>Last Seen</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {status.tracked_ips.map((ip) => (
                                                    <tr key={ip.ip}>
                                                        <td className="font-mono text-text-primary">{ip.ip}</td>
                                                        <td className="text-text-secondary">{ip.request_count}</td>
                                                        <td className="text-text-muted">{new Date(ip.first_seen).toLocaleString()}</td>
                                                        <td className="text-text-muted">{new Date(ip.last_seen).toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Config Section ── */}
                {activeSection === 'config' && !config && (
                    <div className="text-center py-8">
                        <div className="text-3xl mb-3 opacity-20">⚙️</div>
                        <p className="text-text-muted text-xs">Configuration data unavailable. The RSF API may not be reachable.</p>
                    </div>
                )}

                {activeSection === 'config' && config && (
                    <div className="space-y-5">
                        <div>
                            <div className="text-xs text-text-muted uppercase tracking-wider mb-3 font-semibold">Hardening Flags</div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <FlagItem label="Hardening" enabled={config.harden_enabled} />
                                <FlagItem label="TOTP" enabled={config.harden_totp} />
                                <FlagItem label="Rate Limit" enabled={config.harden_rate_limit} />
                                <FlagItem label="IP Tracking" enabled={config.harden_ip_tracking} />
                                <FlagItem label="Verbose" enabled={config.verbose} />
                            </div>
                        </div>

                        <div className="bg-bg-input rounded-xl p-4 border border-border-dim">
                            <div className="text-xs text-text-muted uppercase tracking-wider mb-3 font-semibold">Details</div>
                            <div className="space-y-2 text-xs text-text-secondary">
                                <div className="flex items-center justify-between py-1 border-b border-border-dim/30">
                                    <span>IP Limit</span>
                                    <span className="text-text-primary font-mono">{config.ip_limit}</span>
                                </div>
                                <div className="flex items-center justify-between py-1 border-b border-border-dim/30">
                                    <span>Log File</span>
                                    <span className="text-text-primary font-mono text-[0.65rem] truncate max-w-[200px]">{config.log_file}</span>
                                </div>
                                <div className="flex items-center justify-between py-1 border-b border-border-dim/30">
                                    <span>Archive Dir</span>
                                    <span className="text-text-primary font-mono text-[0.65rem] truncate max-w-[200px]">{config.job_archive?.archive_dir ?? '—'}</span>
                                </div>
                                <div className="flex items-center justify-between py-1 border-b border-border-dim/30">
                                    <span>Max Output</span>
                                    <span className="text-text-primary font-mono">{config.job_archive?.max_output_size_bytes ? (config.job_archive.max_output_size_bytes / 1024 / 1024).toFixed(0) + ' MB' : '—'}</span>
                                </div>
                                <div className="flex items-center justify-between py-1">
                                    <span>Trusted Proxies</span>
                                    <span className="text-text-primary font-mono">{config.trusted_proxies?.length > 0 ? config.trusted_proxies.join(', ') : 'none'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Logs Section ── */}
                {activeSection === 'logs' && (
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <div className="text-xs text-text-muted uppercase tracking-wider font-semibold">Recent Audit Log</div>
                            <button onClick={fetchLogs} className="text-xs text-cyber-green hover:text-cyber-green-dim transition-colors bg-transparent border-0 cursor-pointer">
                                ↻ Refresh
                            </button>
                        </div>
                        <div className="terminal-output max-h-[400px] overflow-y-auto text-[0.65rem]">
                            {logs.length === 0 ? (
                                <div className="text-text-muted text-center py-4">No log entries</div>
                            ) : (
                                logs.map((line, i) => (
                                    <div key={i} className="py-0.5 border-b border-border-dim/30 last:border-0 whitespace-pre-wrap break-all flex gap-3">
                                        <span className="text-text-muted select-none w-8 text-right flex-shrink-0">{i + 1}</span>
                                        <span>{line}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function FlagItem({ label, enabled }: { label: string; enabled: boolean }) {
    return (
        <div className={`stat-card ${enabled ? 'stat-card-green' : ''} flex items-center gap-3`}>
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${enabled ? 'bg-cyber-green animate-pulse-glow' : 'bg-text-muted'}`} />
            <span className="text-xs text-text-secondary">{label}</span>
            <span className={`ml-auto text-xs font-bold ${enabled ? 'text-cyber-green' : 'text-text-muted'}`}>{enabled ? 'ON' : 'OFF'}</span>
        </div>
    );
}
