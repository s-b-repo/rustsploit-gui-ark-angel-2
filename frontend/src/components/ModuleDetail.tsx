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

const CATEGORY_META: Record<string, { icon: string; badge: string; label: string; headerClass: string }> = {
    exploits: { icon: '💥', badge: 'badge-red', label: 'Exploit', headerClass: 'card-header-red' },
    scanners: { icon: '🔍', badge: 'badge-blue', label: 'Scanner', headerClass: 'card-header-blue' },
    creds: { icon: '🔑', badge: 'badge-yellow', label: 'Credential', headerClass: 'card-header-yellow' },
};

export default function ModuleDetail({ selectedModule }: Props) {
    const [info, setInfo] = useState<ModuleInfo | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!selectedModule) {
            setInfo(null);
            return;
        }

        const fetchInfo = async () => {
            setLoading(true);
            try {
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
                    setInfo({
                        name: parts[parts.length - 1],
                        category: parts[0],
                        path: selectedModule,
                        description: undefined,
                    });
                }
            } catch {
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
    if (loading) return <div className="text-xs text-text-muted py-2 animate-pulse">Loading module info...</div>;

    const category = info?.category || selectedModule.split('/')[0];
    const meta = CATEGORY_META[category] || { icon: '📦', badge: 'badge-green', label: 'Module', headerClass: 'card-header-green' };
    const isCamxploit = selectedModule.includes('camxploit');

    return (
        <div className={`glass-card overflow-hidden ${isCamxploit ? 'cat-camxploit' : category === 'exploits' ? 'cat-exploit' : category === 'scanners' ? 'cat-scanner' : category === 'creds' ? 'cat-creds' : ''}`}>
            {/* Gradient header */}
            <div className={`card-header ${isCamxploit ? 'card-header-purple' : meta.headerClass}`}>
                <div className="flex items-center gap-2">
                    <span>{isCamxploit ? '📸' : meta.icon}</span>
                    <span className={`badge ${isCamxploit ? 'badge-purple' : meta.badge} text-[0.55rem]`}>
                        {isCamxploit ? 'CamXploit' : meta.label}
                    </span>
                </div>
            </div>

            {/* Body */}
            <div className="p-4">
                <h4 className="text-sm font-bold text-text-primary font-mono">
                    {info?.name || selectedModule.split('/').pop()}
                </h4>
                <div className="mt-2 text-[0.65rem] text-text-muted font-mono bg-bg-input px-2.5 py-1.5 rounded-lg border border-border-dim inline-block">
                    {info?.path || selectedModule}
                </div>
                {info?.description && (
                    <p className="text-xs text-text-secondary mt-3 leading-relaxed">{info.description}</p>
                )}
            </div>
        </div>
    );
}
