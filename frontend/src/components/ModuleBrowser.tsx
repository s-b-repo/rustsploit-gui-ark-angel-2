import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';
import toast from 'react-hot-toast';

interface ModuleTree {
    [key: string]: ModuleTree | string[];
}

interface Props {
    onSelectModule: (module: string) => void;
    selectedModule: string | null;
}

export default function ModuleBrowser({ onSelectModule, selectedModule }: Props) {
    const [tree, setTree] = useState<ModuleTree>({});
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set(['exploits', 'scanners', 'creds']));
    const [loading, setLoading] = useState(true);
    const [flatModules, setFlatModules] = useState<string[]>([]);

    useEffect(() => {
        loadModules();
    }, []);

    const loadModules = async () => {
        try {
            const res = await apiClient.get('/rsf/modules');
            if (res.data.success) {
                const data = res.data.data || {};
                const all = [...(data.exploits || []), ...(data.scanners || []), ...(data.creds || [])];
                setFlatModules(all);
                setTree(buildTree(all));
            }
        } catch (err: any) {
            toast.error('Failed to load modules');
        } finally {
            setLoading(false);
        }
    };

    const buildTree = (modules: string[]): ModuleTree => {
        const t: any = {};
        for (const mod of modules) {
            const parts = mod.split('/');
            let node = t;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!node[parts[i]]) node[parts[i]] = {};
                node = node[parts[i]];
            }
            if (!node._items) node._items = [];
            node._items.push(mod);
        }
        return t;
    };

    const toggleExpand = (path: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    };

    const filtered = search
        ? flatModules.filter((m) => m.toLowerCase().includes(search.toLowerCase()))
        : [];

    const renderTree = (node: any, path = '', depth = 0): JSX.Element[] => {
        const elements: JSX.Element[] = [];
        const entries = Object.entries(node).filter(([k]) => k !== '_items');

        for (const [key, value] of entries) {
            const fullPath = path ? `${path}/${key}` : key;
            const isExpanded = expanded.has(fullPath);
            const hasChildren = typeof value === 'object' && value !== null;

            if (hasChildren) {
                elements.push(
                    <div key={fullPath}>
                        <button
                            onClick={() => toggleExpand(fullPath)}
                            className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg hover:bg-bg-card-hover transition-all text-xs cursor-pointer bg-transparent border-0 text-text-primary group"
                            style={{ paddingLeft: `${depth * 16 + 12}px` }}
                        >
                            <span className="text-text-muted text-[0.65rem] transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                            <span className="text-cyber-blue">📁</span>
                            <span className="font-semibold group-hover:text-cyber-green transition-colors">{key}</span>
                        </button>
                        {isExpanded && renderTree(value, fullPath, depth + 1)}
                    </div>
                );
            }
        }

        // Render leaf items
        if (node._items) {
            for (const mod of node._items as string[]) {
                const name = mod.split('/').pop();
                const isSelected = selectedModule === mod;
                elements.push(
                    <button
                        key={mod}
                        onClick={() => onSelectModule(mod)}
                        className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg transition-all text-xs cursor-pointer border-0 ${isSelected
                            ? 'bg-cyber-green/15 text-cyber-green border-l-2 border-cyber-green shadow-[inset_0_0_20px_rgba(0,255,65,0.05)]'
                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-card-hover bg-transparent hover:border-l-2 hover:border-cyber-green/30'
                            }`}
                        style={{ paddingLeft: `${depth * 16 + 12}px` }}
                    >
                        <span className="text-[0.7rem]">⚡</span>
                        <span className="truncate">{name}</span>
                    </button>
                );
            }
        }

        return elements;
    };

    return (
        <div className="glass-card overflow-hidden">
            {/* Gradient header */}
            <div className="card-header card-header-green">
                <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <span className="text-cyber-green">📦</span> Module Browser
                </h2>
                <span className="badge badge-green text-[0.6rem]">{flatModules.length} modules</span>
            </div>

            <div className="p-4">
                {/* Search */}
                <div className="relative mb-3">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input-cyber pl-9 text-xs"
                        placeholder="Search modules..."
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">🔍</span>
                </div>

                {/* Module list */}
                <div className="max-h-[400px] overflow-y-auto space-y-0.5 pr-1">
                    {loading ? (
                        <div className="text-center py-8 text-text-muted text-xs animate-pulse">Loading modules...</div>
                    ) : search ? (
                        filtered.length > 0 ? (
                            filtered.map((mod) => (
                                <button
                                    key={mod}
                                    onClick={() => onSelectModule(mod)}
                                    className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg transition-all text-xs cursor-pointer border-0 ${selectedModule === mod
                                        ? 'bg-cyber-green/15 text-cyber-green'
                                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-card-hover bg-transparent'
                                        }`}
                                >
                                    <span>⚡</span>
                                    <span className="truncate">{mod}</span>
                                </button>
                            ))
                        ) : (
                            <div className="text-center py-4 text-text-muted text-xs">No modules found</div>
                        )
                    ) : (
                        renderTree(tree)
                    )}
                </div>
            </div>
        </div>
    );
}
