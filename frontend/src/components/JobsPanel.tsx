import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';
import toast from 'react-hot-toast';

interface Job {
    job_id: string;
    module: string;
    target: string;
    status: string;
    started_at: string;
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
                setJobs(res.data.data.jobs || []);
            }
        } catch (err) {
            toast.error('Failed to load jobs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
        const interval = setInterval(fetchJobs, 5000); // Auto-refresh every 5s
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border-dim flex justify-between items-center">
                <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <span className="text-cyber-yellow">⚡</span> Job History
                </h2>
                <button
                    onClick={fetchJobs}
                    className="text-xs text-cyber-green hover:text-cyber-green-dim transition-colors bg-transparent border-0 cursor-pointer"
                >
                    ↻ Refresh
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                    <thead className="bg-bg-card border-b border-border-dim text-text-muted uppercase tracking-wider">
                        <tr>
                            <th className="p-3 font-medium">Job ID</th>
                            <th className="p-3 font-medium">Module</th>
                            <th className="p-3 font-medium">Target</th>
                            <th className="p-3 font-medium">Status</th>
                            <th className="p-3 font-medium">Duration</th>
                            <th className="p-3 font-medium">Started</th>
                            <th className="p-3 font-medium text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dim">
                        {loading && jobs.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-text-muted">Loading jobs...</td>
                            </tr>
                        ) : jobs.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-text-muted">No jobs found</td>
                            </tr>
                        ) : (
                            jobs.map((job) => (
                                <tr key={job.job_id} className="hover:bg-bg-card-hover transition-colors">
                                    <td className="p-3 font-mono text-text-secondary">{job.job_id.slice(0, 8)}</td>
                                    <td className="p-3 text-text-primary font-medium">{job.module}</td>
                                    <td className="p-3 text-text-secondary font-mono">{job.target}</td>
                                    <td className="p-3">
                                        <span className="flex items-center gap-1">
                                            <span
                                                className={`badge ${job.status === 'Running'
                                                    ? 'badge-blue animate-pulse'
                                                    : job.status === 'Completed'
                                                        ? 'badge-green'
                                                        : job.status === 'Failed'
                                                            ? 'badge-red'
                                                            : 'badge-yellow'
                                                    }`}
                                            >
                                                {job.status}
                                            </span>
                                            {job.status === 'Running' && (Date.now() - new Date(job.started_at).getTime()) > 5 * 60 * 1000 && (
                                                <span title="Running for over 5 minutes" className="text-cyber-yellow text-[0.6rem]">⏱️</span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="p-3 text-text-secondary">
                                        <DurationDisplay job={job} />
                                    </td>
                                    <td className="p-3 text-text-muted">
                                        {new Date(job.started_at).toLocaleString()}
                                    </td>
                                    <td className="p-3 text-right">
                                        <button
                                            onClick={() => onSelectJob(job.job_id)}
                                            className="text-cyber-blue hover:text-white transition-colors bg-transparent border-0 cursor-pointer font-medium"
                                        >
                                            View Output →
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/** Live elapsed‐time display for running jobs */
function DurationDisplay({ job }: { job: { status: string; started_at: string; duration_ms?: number } }) {
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
        return <>{(job.duration_ms / 1000).toFixed(2)}s</>;
    }
    if (job.status === 'Running' && elapsed) {
        return <span className="text-cyber-yellow animate-pulse">{elapsed}</span>;
    }
    return <>-</>;
}
