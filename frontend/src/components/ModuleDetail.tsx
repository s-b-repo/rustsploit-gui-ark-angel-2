import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';

interface ModuleInfo {
    name: string;
    category: string;
    path: string;
    description?: string;
}

interface Props {
    selectedModule: string | null;
}

const CATEGORY_META: Record<string, { icon: string; badge: string; label: string }> = {
    exploits: { icon: '💥', badge: 'badge-red', label: 'Exploit' },
    scanners: { icon: '🔍', badge: 'badge-blue', label: 'Scanner' },
    creds: { icon: '🔑', badge: 'badge-yellow', label: 'Credential' },
};

export default function ModuleDetail({ selectedModule }: Props) {
    const [info, setInfo] = useState<ModuleInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!selectedModule) {
            setInfo(null);
            return;
        }

        const fetchInfo = async () => {
            setLoading(true);
            setError('');
            try {
                // RSF API expects /api/module/{category}/{name} — extract first and last segments
                const parts = selectedModule.split('/');
                const category = parts[0];
                const name = parts[parts.length - 1];
                const res = await apiClient.get(`/rsf/module/${category}/${name}`);
                if (res.data.success && res.data.data) {
                    const d = res.data.data;
                    setInfo({
                        name: d.name,
                        category: d.category,
                        path: d.module || selectedModule,
                        description: undefined,
                    });
                } else {
                    // Fallback: build info from path
                    setInfo({
                        name: parts[parts.length - 1],
                        category: parts[0],
                        path: selectedModule,
                        description: undefined,
                    });
                }
            } catch {
                // Build from path as fallback
                const parts = selectedModule.split('/');
                setInfo({
                    name: parts[parts.length - 1],
                    category: parts[0],
                    path: selectedModule,
                    description: undefined,
                });
            } finally {
                setLoading(false);
            }
        };

        fetchInfo();
    }, [selectedModule]);

    if (!selectedModule) return null;
    if (loading) return <div className="text-xs text-text-muted py-2">Loading module info...</div>;

    const category = info?.category || selectedModule.split('/')[0];
    const meta = CATEGORY_META[category] || { icon: '📦', badge: 'badge-green', label: 'Module' };
    const isCamxploit = selectedModule.includes('camxploit');

    return (
        <div className={`bg-bg-input rounded-lg border border-border-dim p-3 mb-3 ${isCamxploit ? 'cat-camxploit' : category === 'exploits' ? 'cat-exploit' : category === 'scanners' ? 'cat-scanner' : category === 'creds' ? 'cat-creds' : ''
            }`}>
            <div className="flex items-center gap-2 mb-2">
                <span>{isCamxploit ? '📸' : meta.icon}</span>
                <span className={`badge ${isCamxploit ? 'badge-purple' : meta.badge} text-[0.55rem]`}>
                    {isCamxploit ? 'CamXploit' : meta.label}
                </span>
            </div>
            <h4 className="text-sm font-bold text-text-primary font-mono">
                {info?.name || selectedModule.split('/').pop()}
            </h4>
            <p className="text-[0.65rem] text-text-muted font-mono mt-1">{info?.path || selectedModule}</p>
            {info?.description && (
                <p className="text-xs text-text-secondary mt-2 leading-relaxed">{info.description}</p>
            )}
        </div>
    );
}
