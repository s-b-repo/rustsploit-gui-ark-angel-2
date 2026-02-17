import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import apiClient from '../lib/apiClient';
import ModuleBrowser from '../components/ModuleBrowser';
import ModuleDetail from '../components/ModuleDetail';
import ModuleRunner from '../components/ModuleRunner';
import OutputConsole from '../components/OutputConsole';
import JobsPanel from '../components/JobsPanel';
import UserAdminPanel from '../components/UserAdminPanel';
import TargetPanel from '../components/TargetPanel';
import StatusPanel from '../components/StatusPanel';
import ReportsPanel from '../components/ReportsPanel';

type Tab = 'modules' | 'jobs' | 'reports' | 'target' | 'status' | 'users';

type RsfHealthStatus = 'checking' | 'connected' | 'auth_failed' | 'offline' | 'degraded' | 'error';

interface QuickStats {
    activeJobs: number;
    totalModules: number;
    currentTarget: string | null;
    apiStatus: 'connected' | 'disconnected' | 'checking';
}

export default function DashboardPage() {
    const [activeTab, setActiveTab] = useState<Tab>('modules');
    const [selectedModule, setSelectedModule] = useState<string | null>(null);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const { hasPermission, user } = useAuthStore();
    const [rsfHealth, setRsfHealth] = useState<{ status: RsfHealthStatus; message: string }>({ status: 'checking', message: '' });
    const [stats, setStats] = useState<QuickStats>({
        activeJobs: 0,
        totalModules: 0,
        currentTarget: null,
        apiStatus: 'checking',
    });

    // Check RSF API connectivity on mount
    useEffect(() => {
        const checkRsfHealth = async () => {
            try {
                const res = await apiClient.get('/rsf-health');
                if (res.data.success) {
                    setRsfHealth({ status: res.data.status, message: res.data.message });
                    // Update apiStatus based on health check
                    setStats(prev => ({
                        ...prev,
                        apiStatus: res.data.status === 'connected' ? 'connected' : 'disconnected',
                    }));
                }
            } catch {
                setRsfHealth({ status: 'error', message: 'Unable to check RSF API health' });
                setStats(prev => ({ ...prev, apiStatus: 'disconnected' }));
            }
        };
        checkRsfHealth();
    }, []);

    // Fetch quick stats
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [statusRes, modulesRes, targetRes, jobsRes] = await Promise.allSettled([
                    apiClient.get('/rsf/status'),
                    apiClient.get('/rsf/modules/count'),
                    apiClient.get('/rsf/target'),
                    apiClient.get('/rsf/jobs'),
                ]);

                setStats(prev => {
                    const newStats: QuickStats = { ...prev };

                    if (statusRes.status === 'fulfilled' && statusRes.value.data.success) {
                        newStats.apiStatus = 'connected';
                    }

                    if (modulesRes.status === 'fulfilled' && modulesRes.value.data.success) {
                        newStats.totalModules = modulesRes.value.data.data?.total || 0;
                    }

                    if (targetRes.status === 'fulfilled' && targetRes.value.data.success) {
                        newStats.currentTarget = targetRes.value.data.data?.target || null;
                    }

                    if (jobsRes.status === 'fulfilled' && jobsRes.value.data.success) {
                        const jobs = jobsRes.value.data.data?.jobs || jobsRes.value.data.jobs || [];
                        newStats.activeJobs = Array.isArray(jobs)
                            ? jobs.filter((j: any) => j.status === 'Running' || j.status === 'Queued').length
                            : 0;
                    }

                    return newStats;
                });
            } catch {
                setStats(prev => ({ ...prev, apiStatus: 'disconnected' }));
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 15000);
        return () => clearInterval(interval);
    }, []);

    const tabs: { id: Tab; label: string; icon: string; perm: string }[] = [
        { id: 'modules', label: 'Modules', icon: '📦', perm: 'modules.view' },
        { id: 'jobs', label: 'Jobs', icon: '⚡', perm: 'jobs.view' },
        { id: 'reports', label: 'Reports', icon: '📋', perm: 'jobs.view' },
        { id: 'target', label: 'Target', icon: '🎯', perm: 'target.view' },
        { id: 'status', label: 'Status', icon: '📊', perm: 'status.view' },
        ...(hasPermission('users', 'manage') ? [{ id: 'users' as Tab, label: 'Users', icon: '👥', perm: 'users.manage' }] : []),
    ];

    const rsfStatusLabel = rsfHealth.status === 'connected' ? 'RSF ONLINE'
        : rsfHealth.status === 'auth_failed' ? 'RSF DEGRADED'
            : rsfHealth.status === 'offline' ? 'RSF OFFLINE'
                : rsfHealth.status === 'checking' ? 'CHECKING...'
                    : 'RSF ERROR';

    const rsfStatusColor = rsfHealth.status === 'connected' ? 'text-cyber-green'
        : rsfHealth.status === 'auth_failed' ? 'text-orange-400'
            : rsfHealth.status === 'checking' ? 'text-cyber-yellow'
                : 'text-cyber-red';

    const rsfDotColor = rsfHealth.status === 'connected' ? 'bg-cyber-green animate-pulse-glow'
        : rsfHealth.status === 'auth_failed' ? 'bg-orange-400 animate-pulse'
            : rsfHealth.status === 'checking' ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500 animate-pulse';

    return (
        <div className="w-full max-w-[1400px] mx-auto space-y-6">
            {/* Welcome header */}
            <div className="flex items-center justify-between">
                <div className="page-header mb-0">
                    <div className="icon-badge">⚡</div>
                    <div>
                        <h1>
                            Welcome back, <span className="text-cyber-green">{user?.username}</span>
                        </h1>
                        <div className="subtitle">Command Center • Framework Control Interface</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${rsfDotColor}`} />
                    <span className={`text-xs font-semibold tracking-wider ${rsfStatusColor}`}>
                        {rsfStatusLabel}
                    </span>
                </div>
            </div>

            {/* Degraded Service Banner */}
            {rsfHealth.status === 'auth_failed' && (
                <div className="rounded-xl border border-orange-500/40 bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent p-4 flex items-start gap-4" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <div className="text-2xl flex-shrink-0 mt-0.5">⚠️</div>
                    <div className="flex-1">
                        <div className="text-sm font-bold text-orange-400 mb-1">Degraded Service — Wrong RSF API Key</div>
                        <div className="text-xs text-text-secondary leading-relaxed">
                            The backend is using an invalid RSF API key. Login and local features (Users, ACL) work normally,
                            but RSF features (Modules, Jobs, Target, Status) are unavailable.
                        </div>
                        <div className="text-xs text-text-muted mt-2 font-mono bg-bg-input/60 rounded px-3 py-1.5 inline-block border border-border-dim">
                            Fix: restart backend with correct <span className="text-orange-300">RSF_API_KEY</span> env var
                        </div>
                    </div>
                </div>
            )}

            {rsfHealth.status === 'offline' && (
                <div className="rounded-xl border border-red-500/40 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent p-4 flex items-start gap-4" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <div className="text-2xl flex-shrink-0 mt-0.5">🔴</div>
                    <div className="flex-1">
                        <div className="text-sm font-bold text-red-400 mb-1">RSF API Offline</div>
                        <div className="text-xs text-text-secondary leading-relaxed">
                            Cannot connect to the RustSploit API server. Login and local features (Users, ACL) work normally,
                            but RSF features require the API to be running.
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card stat-card-yellow">
                    <div className="flex items-center gap-3">
                        <div className="icon-badge-yellow" style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(255,230,0,0.15), rgba(255,230,0,0.03))', border: '1px solid rgba(255,230,0,0.3)', fontSize: '1rem' }}>⚡</div>
                        <div>
                            <div className="text-[0.6rem] text-text-muted uppercase tracking-wider font-semibold">Active Jobs</div>
                            <div className={`text-lg font-bold text-text-primary ${stats.activeJobs > 0 ? 'text-cyber-yellow animate-pulse' : ''}`}>{stats.activeJobs}</div>
                        </div>
                    </div>
                </div>
                <div className="stat-card stat-card-blue">
                    <div className="flex items-center gap-3">
                        <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.03))', border: '1px solid rgba(0,212,255,0.3)', fontSize: '1rem' }}>📦</div>
                        <div>
                            <div className="text-[0.6rem] text-text-muted uppercase tracking-wider font-semibold">Modules</div>
                            <div className="text-lg font-bold text-text-primary">{stats.totalModules || '—'}</div>
                        </div>
                    </div>
                </div>
                <div className="stat-card stat-card-green">
                    <div className="flex items-center gap-3">
                        <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(0,255,65,0.15), rgba(0,255,65,0.03))', border: '1px solid rgba(0,255,65,0.3)', fontSize: '1rem' }}>🎯</div>
                        <div>
                            <div className="text-[0.6rem] text-text-muted uppercase tracking-wider font-semibold">Target</div>
                            <div className="text-sm font-bold text-text-primary truncate max-w-[140px]">
                                {stats.currentTarget || 'Not set'}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="stat-card stat-card-purple">
                    <div className="flex items-center gap-3">
                        <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(176,0,255,0.15), rgba(176,0,255,0.03))', border: '1px solid rgba(176,0,255,0.3)', fontSize: '1rem' }}>👤</div>
                        <div>
                            <div className="text-[0.6rem] text-text-muted uppercase tracking-wider font-semibold">Role</div>
                            <div className="text-lg font-bold text-text-primary capitalize">{user?.role || '—'}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab navigation */}
            <div className="tab-bar">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`tab-btn ${activeTab === tab.id ? 'tab-btn-active' : ''}`}
                    >
                        <span className="tab-icon">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="min-h-[60vh]">
                {activeTab === 'modules' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <ModuleBrowser onSelectModule={setSelectedModule} selectedModule={selectedModule} />
                        </div>
                        <div className="space-y-4">
                            <ModuleDetail selectedModule={selectedModule} />
                            <ModuleRunner selectedModule={selectedModule} onJobStarted={setActiveJobId} />
                            <OutputConsole jobId={activeJobId} />
                        </div>
                    </div>
                )}
                {activeTab === 'jobs' && (
                    <div className="space-y-4">
                        <JobsPanel onSelectJob={(id) => { setActiveJobId(id); }} />
                        <OutputConsole jobId={activeJobId} />
                    </div>
                )}
                {activeTab === 'reports' && <ReportsPanel />}
                {activeTab === 'target' && <TargetPanel />}
                {activeTab === 'status' && <StatusPanel />}
                {activeTab === 'users' && <UserAdminPanel />}
            </div>
        </div>
    );
}
