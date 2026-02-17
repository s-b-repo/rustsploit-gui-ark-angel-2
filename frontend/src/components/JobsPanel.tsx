import { useState, useEffect } from 'react';
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
}

interface Props {
    onSelectJob: (jobId: string) => void;
}

export default function JobsPanel({ onSelectJob }: Props) {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchJobs = async () => {
        try {
            const res = await apiClient.get('/rsf/jobs');
            if (res.data.success) {
                setJobs(res.data.data?.jobs || res.data.jobs || []);
            }
        } catch (err: any) {
            // 404 means RSF API doesn't have /jobs endpoint yet — silently show empty
            if (err.response?.status !== 404) {
                toast.error('Failed to load jobs');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
        const interval = setInterval(fetchJobs, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleKill = async (jobId: string) => {
        try {
            const res = await apiClient.post(`/rsf/kill/${jobId}`);
            if (res.data.success) {
                toast.success('Job killed');
                fetchJobs();
            } else {
                toast.error(res.data.message || 'Failed to kill job');
            }
        } catch {
            toast.error('Failed to kill job');
        }
    };

    const formatDuration = (ms?: number) => {
        if (ms == null) return '-';
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const cls = status === 'Running'
            ? 'badge-blue animate-pulse'
            : status === 'Completed'
                ? 'badge-green'
                : status === 'Failed'
                    ? 'badge-red'
                    : 'badge-yellow';
        return <span className={`badge ${cls}`}>{status}</span>;
    };

    return (
        <div className="glass-card overflow-hidden">
            {/* Gradient header */}
            <div className="card-header card-header-blue">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                        <span className="text-cyber-blue">⚡</span> Job History
                    </h2>
                    <span className="badge badge-blue text-[0.6rem]">{jobs.length}</span>
                </div>
                <button onClick={fetchJobs} className="text-xs text-cyber-blue hover:text-cyber-blue/80 transition-colors bg-transparent border-0 cursor-pointer">
                    ↻ Refresh
                </button>
            </div>

            {loading ? (
                <div className="p-8 text-center text-text-muted text-xs animate-pulse">Loading jobs...</div>
            ) : jobs.length === 0 ? (
                <div className="p-8 text-center">
                    <div className="text-3xl mb-3 opacity-20">⚡</div>
                    <p className="text-text-muted text-xs">No jobs recorded yet. Run a module to see results here.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="table-premium">
                        <thead>
                            <tr>
                                <th>Job ID</th>
                                <th>Module</th>
                                <th>Target</th>
                                <th>Status</th>
                                <th>Duration</th>
                                <th>Started</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.map((job) => (
                                <tr key={job.job_id}>
                                    <td className="font-mono text-text-secondary text-[0.7rem]">{job.job_id.slice(0, 8)}</td>
                                    <td className="text-text-primary font-medium">{job.module}</td>
                                    <td className="text-text-secondary font-mono text-[0.65rem]">{job.target}</td>
                                    <td><StatusBadge status={job.status} /></td>
                                    <td className="text-text-secondary">{formatDuration(job.duration_ms)}</td>
                                    <td className="text-text-muted text-[0.65rem]">{new Date(job.started_at).toLocaleString()}</td>
                                    <td className="text-right">
                                        <div className="flex items-center gap-1.5 justify-end">
                                            <button
                                                onClick={() => onSelectJob(job.job_id)}
                                                className="btn-outline text-[0.6rem] !px-2 !py-0.5"
                                            >
                                                📺 Output
                                            </button>
                                            {job.status === 'Running' && (
                                                <button
                                                    onClick={() => handleKill(job.job_id)}
                                                    className="px-2 py-0.5 text-[0.6rem] text-cyber-red border border-cyber-red/30 rounded bg-transparent cursor-pointer hover:bg-cyber-red/10 transition-colors font-semibold"
                                                >
                                                    ⬜ Kill
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
