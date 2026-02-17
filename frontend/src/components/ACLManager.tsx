import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';
import toast from 'react-hot-toast';

interface AclTemplate {
    id: number;
    name: string;
    permissions: any; // Backend sends {panels: {mod: {view: bool}}}, component uses {mod: string[]}
    created_at: string;
}

/** Convert backend format {panels:{modules:{view:true,run:true}}} → {modules:["view","run"]} */
function fromBackendPerms(perms: any): Record<string, string[]> {
    if (!perms) return {};
    const panels = perms.panels || perms;
    const result: Record<string, string[]> = {};
    for (const [cat, actions] of Object.entries(panels)) {
        if (Array.isArray(actions)) {
            result[cat] = actions;
        } else if (typeof actions === 'object' && actions !== null) {
            result[cat] = Object.entries(actions as Record<string, boolean>)
                .filter(([, v]) => v)
                .map(([k]) => k);
        }
    }
    return result;
}

/** Convert component format {modules:["view","run"]} → {panels:{modules:{view:true,run:true}}} */
function toBackendPerms(perms: Record<string, string[]>): any {
    const panels: Record<string, Record<string, boolean>> = {};
    for (const [cat, meta] of Object.entries(PERMISSION_CATEGORIES)) {
        panels[cat] = {};
        for (const action of meta.actions) {
            panels[cat][action] = perms[cat]?.includes(action) || false;
        }
    }
    return { panels };
}

const PERMISSION_CATEGORIES = {
    modules: { label: 'Modules', icon: '📦', actions: ['view', 'execute'] },
    jobs: { label: 'Jobs', icon: '⚡', actions: ['view', 'kill'] },
    target: { label: 'Target', icon: '🎯', actions: ['view', 'set'] },
    status: { label: 'Status', icon: '📊', actions: ['view'] },
    users: { label: 'Users', icon: '👥', actions: ['manage'] },
    acl: { label: 'ACL', icon: '🔒', actions: ['manage'] },
};

export default function ACLManager() {
    const [templates, setTemplates] = useState<AclTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editTemplate, setEditTemplate] = useState<AclTemplate | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [permissions, setPermissions] = useState<Record<string, string[]>>({});

    const fetchTemplates = async () => {
        try {
            const res = await apiClient.get('/acl/templates');
            if (res.data.success) setTemplates(res.data.templates || res.data.data || []);
        } catch {
            toast.error('Failed to load ACL templates');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTemplates(); }, []);

    const openCreate = () => {
        setEditTemplate(null);
        setName('');
        setPermissions({});
        setShowModal(true);
    };

    const openEdit = (template: AclTemplate) => {
        setEditTemplate(template);
        setName(template.name);
        setPermissions(fromBackendPerms(template.permissions));
        setShowModal(true);
    };

    const togglePermission = (category: string, action: string) => {
        setPermissions(prev => {
            const next = { ...prev };
            if (!next[category]) next[category] = [];
            if (next[category].includes(action)) {
                next[category] = next[category].filter(a => a !== action);
                if (next[category].length === 0) delete next[category];
            } else {
                next[category] = [...next[category], action];
            }
            return next;
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const backendPerms = toBackendPerms(permissions);
        try {
            if (editTemplate) {
                const res = await apiClient.put(`/acl/templates/${editTemplate.id}`, { name, permissions: backendPerms });
                if (res.data.success) toast.success('Template updated');
                else toast.error(res.data.message || 'Update failed');
            } else {
                const res = await apiClient.post('/acl/templates', { name, permissions: backendPerms });
                if (res.data.success) toast.success('Template created');
                else toast.error(res.data.message || 'Creation failed');
            }
            setShowModal(false);
            fetchTemplates();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Save failed');
        }
    };

    const handleDelete = async (template: AclTemplate) => {
        if (!confirm(`Delete ACL template "${template.name}"? This cannot be undone.`)) return;
        try {
            const res = await apiClient.delete(`/acl/templates/${template.id}`);
            if (res.data.success) {
                toast.success('Template deleted');
                fetchTemplates();
            } else {
                toast.error(res.data.message || 'Delete failed');
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Delete failed');
        }
    };

    const countPerms = (perms: any): number => {
        try {
            const flat = fromBackendPerms(perms);
            return Object.values(flat).reduce((sum, arr) => sum + arr.length, 0);
        } catch { return 0; }
    };

    return (
        <>
            <div className="glass-card overflow-hidden">
                {/* Gradient header */}
                <div className="card-header card-header-yellow">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                            <span className="text-cyber-yellow">🔒</span> ACL Templates
                        </h2>
                        <span className="badge badge-yellow text-[0.6rem]">{templates.length}</span>
                    </div>
                    <button onClick={openCreate} className="btn-glow text-xs !py-1.5 !px-4">
                        + Create Template
                    </button>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-text-muted text-xs animate-pulse">Loading templates...</div>
                ) : templates.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="text-3xl mb-3 opacity-20">🔒</div>
                        <p className="text-text-muted text-xs">No ACL templates. Create one to restrict user permissions.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table-premium">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Permissions</th>
                                    <th>Created</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {templates.map((template) => (
                                    <tr key={template.id}>
                                        <td className="text-text-primary font-semibold">{template.name}</td>
                                        <td>
                                            <div className="flex flex-wrap gap-1">
                                                {Object.entries(fromBackendPerms(template.permissions)).flatMap(([cat, actions]) =>
                                                    (actions as string[]).map(action => (
                                                        <span key={`${cat}.${action}`} className="bg-bg-card px-1.5 py-0.5 rounded text-[0.55rem] text-text-muted border border-border-dim">
                                                            {cat}.{action}
                                                        </span>
                                                    ))
                                                )}
                                                {countPerms(template.permissions) === 0 && (
                                                    <span className="text-text-muted text-[0.6rem]">No permissions</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-text-muted text-[0.65rem]">
                                            {new Date(template.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center gap-1.5 justify-end">
                                                <button onClick={() => openEdit(template)} className="btn-outline text-[0.6rem] !px-2 !py-0.5">
                                                    ✏️ Edit
                                                </button>
                                                <button onClick={() => handleDelete(template)}
                                                    className="px-2 py-0.5 text-[0.6rem] text-cyber-red border border-cyber-red/30 rounded bg-transparent cursor-pointer hover:bg-cyber-red/10 transition-colors font-semibold"
                                                >
                                                    🗑 Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
                    <div className="glass-card w-full max-w-lg overflow-hidden">
                        <div className={`card-header ${editTemplate ? 'card-header-blue' : 'card-header-green'}`}>
                            <h3 className="text-sm font-bold text-text-primary">
                                {editTemplate ? '✏️ Edit Template' : '➕ Create Template'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-text-muted hover:text-text-primary text-sm bg-transparent border-0 cursor-pointer">✕</button>
                        </div>
                        <form onSubmit={handleSave} className="p-5 space-y-5">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider font-semibold">Template Name</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-cyber" required placeholder="e.g. Read-Only Operator" />
                            </div>

                            <div>
                                <label className="block text-xs text-text-secondary mb-2 uppercase tracking-wider font-semibold">Permissions</label>
                                <div className="space-y-3">
                                    {Object.entries(PERMISSION_CATEGORIES).map(([cat, meta]) => (
                                        <div key={cat} className="bg-bg-input rounded-lg p-3 border border-border-dim">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span>{meta.icon}</span>
                                                <span className="text-xs font-semibold text-text-primary">{meta.label}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {meta.actions.map(action => {
                                                    const isActive = permissions[cat]?.includes(action) || false;
                                                    return (
                                                        <button
                                                            key={action}
                                                            type="button"
                                                            onClick={() => togglePermission(cat, action)}
                                                            className={`px-3 py-1.5 rounded text-[0.65rem] font-semibold transition-all cursor-pointer border ${isActive
                                                                ? 'bg-cyber-green/15 text-cyber-green border-cyber-green/30'
                                                                : 'bg-bg-card text-text-muted border-border-dim hover:text-text-secondary'
                                                                }`}
                                                        >
                                                            {isActive ? '✓ ' : ''}{action}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="submit" className="btn-glow flex-1">
                                    {editTemplate ? 'Save Changes' : 'Create Template'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
