import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';

export default function TargetPanel() {
    const [target, setTarget] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [newTarget, setNewTarget] = useState('');
    const { hasPermission } = useAuthStore();
    const canSetTarget = hasPermission('target', 'set');

    const fetchTarget = async () => {
        try {
            const res = await apiClient.get('/rsf/target');
            if (res.data.success) {
                setTarget(res.data.data.target);
            }
        } catch (err) {
            toast.error('Failed to load target');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTarget();
    }, []);

    const handleSetTarget = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTarget.trim()) return;

        try {
            const res = await apiClient.post('/rsf/target', { target: newTarget });
            if (res.data.success) {
                toast.success('Target updated');
                setTarget(newTarget);
                setNewTarget('');
            } else {
                toast.error(res.data.message || 'Failed to set target');
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to set target');
        }
    };

    const handleClearTarget = async () => {
        if (!confirm('Clear the global target?')) return;
        try {
            const res = await apiClient.delete('/rsf/target');
            if (res.data.success) {
                toast.success('Target cleared');
                setTarget(null);
            }
        } catch (err: any) {
            toast.error('Failed to clear target');
        }
    };

    return (
        <div className="glass-card p-6 max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyber-green/20 to-cyber-green/5 border border-border-glow mb-4">
                    <span className="text-3xl">🎯</span>
                </div>
                <h2 className="text-xl font-bold text-text-primary">Global Target Configuration</h2>
                <p className="text-xs text-text-muted mt-1">Set the primary target for all modules</p>
            </div>

            <div className="bg-bg-input rounded-xl p-6 border border-border-dim mb-8">
                <div className="text-xs text-text-muted uppercase tracking-wider mb-2 text-center">Current Target</div>
                <div className="text-2xl font-mono text-center font-bold">
                    {loading ? (
                        <span className="text-text-muted animate-pulse">Checking...</span>
                    ) : target ? (
                        <span className="text-cyber-green">{target}</span>
                    ) : (
                        <span className="text-text-muted italic">No target set</span>
                    )}
                </div>
            </div>

            {canSetTarget ? (
                <form onSubmit={handleSetTarget} className="space-y-4">
                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider">New Target Payload</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newTarget}
                                onChange={(e) => setNewTarget(e.target.value)}
                                className="input-cyber flex-1"
                                placeholder="IP, Hostname, or CIDR (e.g. 192.168.1.0/24)"
                            />
                            <button type="submit" className="btn-glow">
                                Set Target
                            </button>
                        </div>
                    </div>

                    {target && (
                        <div className="text-center mt-6 pt-6 border-t border-border-dim">
                            <button
                                type="button"
                                onClick={handleClearTarget}
                                className="text-cyber-red hover:text-red-400 text-sm transition-colors bg-transparent border-0 cursor-pointer"
                            >
                                Clear Target Configuration
                            </button>
                        </div>
                    )}
                </form>
            ) : (
                <div className="p-4 bg-cyber-red/10 border border-cyber-red/30 rounded-lg text-center text-cyber-red text-sm">
                    Insufficient permissions to modify target configuration.
                </div>
            )}
        </div>
    );
}
