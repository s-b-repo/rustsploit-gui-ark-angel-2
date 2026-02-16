import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import apiClient from '../lib/apiClient';
import ModuleBrowser from '../components/ModuleBrowser';
import ModuleDetail from '../components/ModuleDetail';
import ModuleRunner from '../components/ModuleRunner';
import OutputConsole from '../components/OutputConsole';
import JobsPanel from '../components/JobsPanel';
import UserManagement from '../components/UserManagement';
import ACLManager from '../components/ACLManager';
import TargetPanel from '../components/TargetPanel';
import StatusPanel from '../components/StatusPanel';
import ReportsPanel from '../components/ReportsPanel';

type Tab = 'modules' | 'jobs' | 'reports' | 'target' | 'status' | 'users' | 'acl';

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
    const [stats, setStats] = useState<QuickStats>({
        activeJobs: 0,
        totalModules: 0,
        currentTarget: null,
        apiStatus: 'checking',
    });

    // Fetch quick stats
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [statusRes, modulesRes, targetRes, jobsRes] = await Promise.allSettled([
                    apiClient.get('/rsf/status'),
                    apiClient.get('/rsf/modules'),
                    apiClient.get('/rsf/target'),
                    apiClient.get('/rsf/jobs'),
                ]);

                setStats(prev => {
                    const newStats: QuickStats = { ...prev };

                    if (statusRes.status === 'fulfilled' && statusRes.value.data.success) {
                        newStats.apiStatus = 'connected';
                    } else {
                        newStats.apiStatus = 'disconnected';
                    }

                    if (modulesRes.status === 'fulfilled' && modulesRes.value.data.success) {
                        const data = modulesRes.value.data.data || {};
                        const mods = [...(data.exploits || []), ...(data.scanners || []), ...(data.creds || [])];
                        newStats.totalModules = mods.length;
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
        ...(hasPermission('acl', 'manage') ? [{ id: 'acl' as Tab, label: 'ACL', icon: '🔒', perm: 'acl.manage' }] : []),
    ];

    return (
        <div className="space-y-6">
            {/* Welcome header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-text-primary">
                        Welcome back, <span className="text-cyber-green">{user?.username}</span>
                    </h1>
                    <p className="text-xs text-text-muted mt-1">RustSploit Command Center • Framework Control Interface</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className={stats.apiStatus === 'connected' ? 'status-dot-green' : stats.apiStatus === 'disconnected' ? 'status-dot-red' : 'status-dot-yellow'} />
                    <span className={`text-xs font-medium ${stats.apiStatus === 'connected' ? 'text-cyber-green' : stats.apiStatus === 'disconnected' ? 'text-cyber-red' : 'text-cyber-yellow'}`}>
                        {stats.apiStatus === 'connected' ? 'RSF Online' : stats.apiStatus === 'disconnected' ? 'RSF Offline' : 'Checking...'}
                    </span>
                </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-bg-secondary rounded-lg p-3 border border-border-dim flex items-center gap-3">
                    <span className="text-xl">⚡</span>
                    <div>
                        <div className="text-[0.6rem] text-text-muted uppercase tracking-wider">Active Jobs</div>
                        <div className="text-sm font-bold text-text-primary">{stats.activeJobs}</div>
                    </div>
                </div>
                <div className="bg-bg-secondary rounded-lg p-3 border border-border-dim flex items-center gap-3">
                    <span className="text-xl">📦</span>
                    <div>
                        <div className="text-[0.6rem] text-text-muted uppercase tracking-wider">Modules</div>
                        <div className="text-sm font-bold text-text-primary">{stats.totalModules || '—'}</div>
                    </div>
                </div>
                <div className="bg-bg-secondary rounded-lg p-3 border border-border-dim flex items-center gap-3">
                    <span className="text-xl">🎯</span>
                    <div>
                        <div className="text-[0.6rem] text-text-muted uppercase tracking-wider">Target</div>
                        <div className="text-sm font-bold text-text-primary truncate max-w-[120px]">
                            {stats.currentTarget || 'Not set'}
                        </div>
                    </div>
                </div>
                <div className="bg-bg-secondary rounded-lg p-3 border border-border-dim flex items-center gap-3">
                    <span className="text-xl">👤</span>
                    <div>
                        <div className="text-[0.6rem] text-text-muted uppercase tracking-wider">Role</div>
                        <div className="text-sm font-bold text-text-primary">{user?.role || '—'}</div>
                    </div>
                </div>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 bg-bg-secondary rounded-xl p-1 border border-border-dim overflow-x-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer border-0 ${activeTab === tab.id
                            ? 'bg-cyber-green/15 text-cyber-green border border-border-glow shadow-[0_0_15px_var(--color-cyber-green-glow)]'
                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-card bg-transparent'
                            }`}
                    >
                        <span className="text-sm">{tab.icon}</span>
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
                {activeTab === 'users' && <UserManagement />}
                {activeTab === 'acl' && <ACLManager />}
            </div>
        </div>
    );
}
