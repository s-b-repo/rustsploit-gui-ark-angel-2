import { useState, useEffect, useCallback } from 'react';
import apiClient from '../lib/apiClient';
import toast from 'react-hot-toast';

interface Job {
    job_id: string;
    module: string;
    target: string;
    status: string;
    started_at: string;
    completed_at?: string;
    duration_ms?: number;
    output?: string;
    truncated?: boolean;
}

interface ReportStats {
    total: number;
    completed: number;
    failed: number;
    running: number;
    avgDurationMs: number;
    successRate: number;
    moduleBreakdown: Record<string, number>;
}

type StatusFilter = 'all' | 'Running' | 'Completed' | 'Failed' | 'Timeout';

export default function ReportsPanel() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<ReportStats>({
        total: 0, completed: 0, failed: 0, running: 0,
        avgDurationMs: 0, successRate: 0, moduleBreakdown: {},
    });
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedJob, setExpandedJob] = useState<string | null>(null);
    const [expandedOutput, setExpandedOutput] = useState<string>('');
    const [loadingOutput, setLoadingOutput] = useState(false);
    const [sortField, setSortField] = useState<'started_at' | 'duration_ms' | 'module'>('started_at');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const fetchJobs = useCallback(async () => {
        try {
            const res = await apiClient.get('/rsf/jobs');
            if (res.data.success) {
                const jobList: Job[] = res.data.data?.jobs || [];
                setJobs(jobList);
                computeStats(jobList);
            }
        } catch (err: any) {
            if (err.response?.status !== 404) {
                toast.error('Failed to load job data');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchJobs();
        const interval = setInterval(fetchJobs, 10000);
        return () => clearInterval(interval);
    }, [fetchJobs]);

    const computeStats = (jobList: Job[]) => {
        const total = jobList.length;
        const completed = jobList.filter(j => j.status === 'Completed').length;
        const failed = jobList.filter(j => j.status === 'Failed').length;
        const running = jobList.filter(j => j.status === 'Running').length;

        const durations = jobList
            .filter(j => j.duration_ms != null)
            .map(j => j.duration_ms!);
        const avgDurationMs = durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : 0;

        const successRate = total > 0 ? (completed / total) * 100 : 0;

        const moduleBreakdown: Record<string, number> = {};
        jobList.forEach(j => {
            moduleBreakdown[j.module] = (moduleBreakdown[j.module] || 0) + 1;
        });

        setStats({ total, completed, failed, running, avgDurationMs, successRate, moduleBreakdown });
    };

    const fetchOutput = async (jobId: string) => {
        if (expandedJob === jobId) {
            setExpandedJob(null);
            setExpandedOutput('');
            return;
        }
        setExpandedJob(jobId);
        setLoadingOutput(true);
        try {
            const res = await apiClient.get(`/rsf/output/${jobId}`);
            if (res.data.success) {
                setExpandedOutput(res.data.data?.output || '(no output)');
            } else {
                setExpandedOutput('Failed to load output');
            }
        } catch {
            setExpandedOutput('Error fetching output');
        } finally {
            setLoadingOutput(false);
        }
    };

    const exportJSON = () => {
        const filtered = getFilteredJobs();
        const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rustsploit_report_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${filtered.length} job(s) as JSON`);
    };

    const getFilteredJobs = (): Job[] => {
        let filtered = [...jobs];

        if (statusFilter !== 'all') {
            filtered = filtered.filter(j => j.status === statusFilter);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(j =>
                j.module.toLowerCase().includes(q) ||
                j.target.toLowerCase().includes(q) ||
                j.job_id.toLowerCase().includes(q)
            );
        }

        filtered.sort((a, b) => {
            let cmp = 0;
            if (sortField === 'started_at') {
                cmp = new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
            } else if (sortField === 'duration_ms') {
                cmp = (a.duration_ms || 0) - (b.duration_ms || 0);
            } else if (sortField === 'module') {
                cmp = a.module.localeCompare(b.module);
            }
            return sortDir === 'desc' ? -cmp : cmp;
        });

        return filtered;
    };

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const sortIndicator = (field: typeof sortField) => {
        if (sortField !== field) return '';
        return sortDir === 'asc' ? ' ↑' : ' ↓';
    };

    const formatDuration = (ms?: number) => {
        if (ms == null) return '-';
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    };

    const filteredJobs = getFilteredJobs();

    if (loading) {
        return (
            <div className="glass-card p-12 text-center">
                <div className="animate-pulse text-text-muted text-sm">Loading reports...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="stat-card stat-card-blue">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">📊</span>
                        <span className="text-[0.6rem] text-text-muted uppercase tracking-wider">Total Jobs</span>
                    </div>
                    <div className="text-lg font-bold text-cyber-blue">{stats.total}</div>
                </div>
                <div className="stat-card stat-card-green">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">✅</span>
                        <span className="text-[0.6rem] text-text-muted uppercase tracking-wider">Completed</span>
                    </div>
                    <div className="text-lg font-bold text-cyber-green">{stats.completed}</div>
                </div>
                <div className="stat-card stat-card-red">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">❌</span>
                        <span className="text-[0.6rem] text-text-muted uppercase tracking-wider">Failed</span>
                    </div>
                    <div className="text-lg font-bold text-cyber-red">{stats.failed}</div>
                </div>
                <div className="stat-card stat-card-yellow">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">⚡</span>
                        <span className="text-[0.6rem] text-text-muted uppercase tracking-wider">Running</span>
                    </div>
                    <div className="text-lg font-bold text-cyber-yellow">{stats.running}</div>
                </div>
                <div className="stat-card stat-card-green">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">📈</span>
                        <span className="text-[0.6rem] text-text-muted uppercase tracking-wider">Success Rate</span>
                    </div>
                    <div className="text-lg font-bold text-cyber-green">{stats.successRate.toFixed(0)}%</div>
                </div>
                <div className="stat-card stat-card-blue">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">⏱️</span>
                        <span className="text-[0.6rem] text-text-muted uppercase tracking-wider">Avg Duration</span>
                    </div>
                    <div className="text-lg font-bold text-cyber-blue">{formatDuration(stats.avgDurationMs)}</div>
                </div>
            </div>

            {/* Module Breakdown */}
            {Object.keys(stats.moduleBreakdown).length > 0 && (
                <div className="glass-card overflow-hidden">
                    <div className="card-header card-header-purple">
                        <h3 className="text-xs font-bold text-text-primary flex items-center gap-2">
                            <span className="text-cyber-purple">📦</span> Module Usage
                        </h3>
                    </div>
                    <div className="p-4 flex flex-wrap gap-2">
                        {Object.entries(stats.moduleBreakdown)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 12)
                            .map(([mod, count]) => (
                                <span
                                    key={mod}
                                    className="bg-bg-card px-2.5 py-1.5 rounded-lg text-[0.65rem] text-text-secondary border border-border-dim cursor-pointer hover:border-cyber-green/40 hover:bg-bg-card-hover transition-all"
                                    onClick={() => setSearchQuery(mod)}
                                    title={`Click to filter by ${mod}`}
                                >
                                    {mod.split('/').pop()} <span className="text-text-muted ml-1">×{count}</span>
                                </span>
                            ))
                        }
                    </div>
                </div>
            )}

            {/* Filters & Actions */}
            <div className="glass-card overflow-hidden">
                <div className="card-header card-header-green">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                            <input
                                type="text"
                                placeholder="Search module, target, or job ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input-cyber pl-8 text-xs !py-2"
                            />
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs">🔍</span>
                        </div>

                        {/* Status Filter */}
                        <div className="flex items-center gap-1">
                            {(['all', 'Running', 'Completed', 'Failed', 'Timeout'] as StatusFilter[]).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`px-3 py-1.5 rounded-lg text-[0.65rem] font-semibold transition-all border cursor-pointer ${statusFilter === s
                                        ? 'bg-cyber-green/15 text-cyber-green border-cyber-green/30'
                                        : 'bg-transparent text-text-muted hover:text-text-primary border-transparent'
                                        }`}
                                >
                                    {s === 'all' ? 'All' : s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-2">
                        <button
                            onClick={fetchJobs}
                            className="btn-outline text-[0.65rem]"
                        >
                            ↻ Refresh
                        </button>
                        <button
                            onClick={exportJSON}
                            disabled={filteredJobs.length === 0}
                            className="btn-glow text-[0.65rem] !py-1.5 !px-3 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            📥 Export
                        </button>
                    </div>
                </div>

                <div className="px-3 py-1.5 text-[0.6rem] text-text-muted bg-bg-secondary/30 border-b border-border-dim/50">
                    Showing {filteredJobs.length} of {jobs.length} job(s)
                </div>

                {/* Job History Table */}
                <div className="overflow-x-auto">
                    <table className="table-premium">
                        <thead>
                            <tr>
                                <th>Job ID</th>
                                <th className="cursor-pointer hover:text-text-primary select-none" onClick={() => toggleSort('module')}>
                                    Module{sortIndicator('module')}
                                </th>
                                <th>Target</th>
                                <th>Status</th>
                                <th className="cursor-pointer hover:text-text-primary select-none" onClick={() => toggleSort('duration_ms')}>
                                    Duration{sortIndicator('duration_ms')}
                                </th>
                                <th className="cursor-pointer hover:text-text-primary select-none" onClick={() => toggleSort('started_at')}>
                                    Started{sortIndicator('started_at')}
                                </th>
                                <th className="text-right">Output</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredJobs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-text-muted">
                                        {searchQuery || statusFilter !== 'all'
                                            ? 'No jobs match the current filters'
                                            : 'No jobs recorded yet. Run a module to see results here.'
                                        }
                                    </td>
                                </tr>
                            ) : (
                                filteredJobs.map((job) => (
                                    <>
                                        <tr
                                            key={job.job_id}
                                            className={`cursor-pointer ${expandedJob === job.job_id ? 'bg-bg-card-hover' : ''}`}
                                            onClick={() => fetchOutput(job.job_id)}
                                        >
                                            <td className="font-mono text-text-secondary text-[0.7rem]">{job.job_id.slice(0, 8)}</td>
                                            <td className="text-text-primary font-medium">{job.module}</td>
                                            <td className="text-text-secondary font-mono text-[0.65rem]">{job.target}</td>
                                            <td>
                                                <StatusBadge status={job.status} startedAt={job.started_at} />
                                            </td>
                                            <td className="text-text-secondary">
                                                <DurationCell job={job} />
                                            </td>
                                            <td className="text-text-muted text-[0.65rem]">
                                                {new Date(job.started_at).toLocaleString()}
                                            </td>
                                            <td className="text-right">
                                                <span className="text-cyber-blue text-[0.65rem]">
                                                    {expandedJob === job.job_id ? '▲ Hide' : '▼ View'}
                                                </span>
                                            </td>
                                        </tr>
                                        {expandedJob === job.job_id && (
                                            <tr key={`${job.job_id}-output`}>
                                                <td colSpan={7} className="p-0">
                                                    <div className="terminal-output m-3 max-h-[400px] overflow-auto text-[0.65rem]">
                                                        {loadingOutput ? (
                                                            <span className="text-text-muted italic animate-pulse">Loading output...</span>
                                                        ) : (
                                                            <pre className="whitespace-pre-wrap break-all">{expandedOutput}</pre>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

/* ─── Sub-components ──────────────────────────────────────────── */

function StatusBadge({ status, startedAt }: { status: string; startedAt: string }) {
    const cls = status === 'Running'
        ? 'badge-blue animate-pulse'
        : status === 'Completed'
            ? 'badge-green'
            : status === 'Failed'
                ? 'badge-red'
                : 'badge-yellow';

    // Show warning icon for long-running jobs (> 5 min)
    const isLongRunning = status === 'Running' &&
        (Date.now() - new Date(startedAt).getTime()) > 5 * 60 * 1000;

    return (
        <span className="flex items-center gap-1">
            <span className={`badge ${cls}`}>{status}</span>
            {isLongRunning && <span title="Running for over 5 minutes" className="text-cyber-yellow text-[0.6rem]">⏱️</span>}
        </span>
    );
}

function DurationCell({ job }: { job: Job }) {
    const [elapsed, setElapsed] = useState('');

    useEffect(() => {
        if (job.status !== 'Running') {
            setElapsed('');
            return;
        }

        const update = () => {
            const ms = Date.now() - new Date(job.started_at).getTime();
            if (ms < 1000) setElapsed(`${ms}ms`);
            else if (ms < 60000) setElapsed(`${(ms / 1000).toFixed(0)}s`);
            else setElapsed(`${(ms / 60000).toFixed(1)}m`);
        };

        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [job.status, job.started_at]);

    if (job.duration_ms != null) {
        const ms = job.duration_ms;
        if (ms < 1000) return <>{ms}ms</>;
        if (ms < 60000) return <>{(ms / 1000).toFixed(2)}s</>;
        return <>{(ms / 60000).toFixed(1)}m</>;
    }

    if (job.status === 'Running' && elapsed) {
        return <span className="text-cyber-yellow animate-pulse">{elapsed}</span>;
    }

    return <>-</>;
}
