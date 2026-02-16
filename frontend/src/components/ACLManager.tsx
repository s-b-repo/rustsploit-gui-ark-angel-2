import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';
import toast from 'react-hot-toast';

interface ACLTemplate {
    id: number;
    name: string;
    permissions: PermissionsObj;
    created_at: string;
}

interface PanelPerms {
    [action: string]: boolean;
}

interface PermissionsObj {
    panels: {
        [panel: string]: PanelPerms;
    };
}

// All available permissions
const ALL_PANELS: { panel: string; label: string; icon: string; actions: { key: string; label: string }[] }[] = [
    { panel: 'modules', label: 'Modules', icon: '📦', actions: [{ key: 'view', label: 'View' }, { key: 'run', label: 'Run' }] },
    { panel: 'jobs', label: 'Jobs', icon: '📋', actions: [{ key: 'view', label: 'View' }] },
    { panel: 'target', label: 'Target', icon: '🎯', actions: [{ key: 'view', label: 'View' }, { key: 'set', label: 'Set / Clear' }] },
    { panel: 'status', label: 'Status', icon: '📊', actions: [{ key: 'view', label: 'View' }] },
    { panel: 'settings', label: 'Settings', icon: '⚙️', actions: [{ key: 'view', label: 'View' }] },
    { panel: 'users', label: 'Users', icon: '👥', actions: [{ key: 'manage', label: 'Manage' }] },
    { panel: 'acl', label: 'ACL', icon: '🔒', actions: [{ key: 'manage', label: 'Manage' }] },
];

function buildDefaultPerms(): PermissionsObj {
    const panels: { [k: string]: PanelPerms } = {};
    ALL_PANELS.forEach(({ panel, actions }) => {
        panels[panel] = {};
        actions.forEach(a => { panels[panel][a.key] = true; });
    });
    return { panels };
}

function PermissionTreeEditor({ permissions, onChange }: { permissions: PermissionsObj; onChange: (p: PermissionsObj) => void }) {
    const toggle = (panel: string, action: string) => {
        const updated = JSON.parse(JSON.stringify(permissions)) as PermissionsObj;
        if (!updated.panels[panel]) updated.panels[panel] = {};
        updated.panels[panel][action] = !updated.panels[panel][action];
        onChange(updated);
    };

    const togglePanel = (panel: string, actions: { key: string }[]) => {
        const allEnabled = actions.every(a => permissions.panels[panel]?.[a.key]);
        const updated = JSON.parse(JSON.stringify(permissions)) as PermissionsObj;
        if (!updated.panels[panel]) updated.panels[panel] = {};
        actions.forEach(a => { updated.panels[panel][a.key] = !allEnabled; });
        onChange(updated);
    };

    return (
        <div className="space-y-2">
            {ALL_PANELS.map(({ panel, label, icon, actions }) => {
                const allEnabled = actions.every(a => permissions.panels[panel]?.[a.key]);
                return (
                    <div key={panel} className="bg-bg-input rounded-lg border border-border-dim p-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-sm">{icon}</span>
                                <span className="text-xs font-bold text-text-primary uppercase tracking-wider">{label}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => togglePanel(panel, actions)}
                                className={`text-[0.6rem] px-2 py-0.5 rounded border cursor-pointer transition-all ${allEnabled
                                    ? 'border-cyber-green/30 text-cyber-green bg-cyber-green/5 hover:bg-cyber-green/10'
                                    : 'border-border-dim text-text-muted hover:text-text-secondary'
                                    }`}
                            >
                                {allEnabled ? 'All On' : 'Enable All'}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-4">
                            {actions.map(a => (
                                <label key={a.key} className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                                    <div className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={!!permissions.panels[panel]?.[a.key]}
                                            onChange={() => toggle(panel, a.key)}
                                        />
                                        <span className="toggle-slider" />
                                    </div>
                                    {a.label}
                                </label>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function ACLManager() {
    const [templates, setTemplates] = useState<ACLTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editTemplate, setEditTemplate] = useState<ACLTemplate | null>(null);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newPermissions, setNewPermissions] = useState<PermissionsObj>(buildDefaultPerms());

    const fetchTemplates = async () => {
        try {
            const res = await apiClient.get('/acl/templates');
            if (res.data.success) {
                setTemplates(res.data.templates);
            }
        } catch (err: any) {
            toast.error('Failed to load ACL templates');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await apiClient.post('/acl/templates', {
                name: newTemplateName,
                permissions: newPermissions
            });
            if (res.data.success) {
                toast.success('Template created');
                setShowCreateModal(false);
                setNewTemplateName('');
                setNewPermissions(buildDefaultPerms());
                fetchTemplates();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to create template');
        }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTemplate) return;
        try {
            const res = await apiClient.put(`/acl/templates/${editTemplate.id}`, {
                name: editTemplate.name,
                permissions: editTemplate.permissions,
            });
            if (res.data.success) {
                toast.success('Template updated');
                setShowEditModal(false);
                setEditTemplate(null);
                fetchTemplates();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update template');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this template? Users assigned to it will lose specific permissions.')) return;
        try {
            const res = await apiClient.delete(`/acl/templates/${id}`);
            if (res.data.success) {
                toast.success('Template deleted');
                fetchTemplates();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to delete template');
        }
    };

    const openEditModal = (t: ACLTemplate) => {
        setEditTemplate(JSON.parse(JSON.stringify(t)));
        setShowEditModal(true);
    };

    return (
        <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border-dim flex justify-between items-center">
                <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <span className="text-cyber-purple">🔒</span> ACL Templates
                </h2>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-glow px-3 py-1.5 text-xs"
                >
                    + New Template
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                    <thead className="bg-bg-card border-b border-border-dim text-text-muted uppercase tracking-wider">
                        <tr>
                            <th className="p-3 font-medium">ID</th>
                            <th className="p-3 font-medium">Name</th>
                            <th className="p-3 font-medium">Permissions Summary</th>
                            <th className="p-3 font-medium">Created</th>
                            <th className="p-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dim">
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-text-muted">Loading templates...</td></tr>
                        ) : templates.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-text-muted">No templates found</td></tr>
                        ) : (
                            templates.map((t) => (
                                <tr key={t.id} className="hover:bg-bg-card-hover transition-colors">
                                    <td className="p-3 text-text-secondary font-mono">{t.id}</td>
                                    <td className="p-3 text-text-primary font-medium">{t.name}</td>
                                    <td className="p-3 text-text-secondary">
                                        <div className="flex flex-wrap gap-1">
                                            {Object.entries(t.permissions?.panels || {}).map(([panel, perms]) => {
                                                const activeActions = Object.entries(perms as PanelPerms)
                                                    .filter(([, v]) => v)
                                                    .map(([k]) => k);
                                                if (activeActions.length === 0) return null;
                                                return (
                                                    <span key={panel} className="badge badge-green text-[0.55rem]" title={`${panel}: ${activeActions.join(', ')}`}>
                                                        {panel}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </td>
                                    <td className="p-3 text-text-muted">{new Date(t.created_at).toLocaleDateString()}</td>
                                    <td className="p-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openEditModal(t)}
                                                className="btn-outline !text-[0.6rem] !py-0.5 !px-2"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(t.id)}
                                                className="text-cyber-red hover:text-red-400 transition-colors bg-transparent border-0 cursor-pointer"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="glass-card w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
                        <h3 className="text-lg font-bold text-text-primary mb-4">New ACL Template</h3>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Template Name *</label>
                                <input
                                    type="text"
                                    value={newTemplateName}
                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                    className="input-cyber"
                                    placeholder="e.g. Senior Pentester"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-text-secondary mb-2 uppercase tracking-wider">Permissions</label>
                                <PermissionTreeEditor permissions={newPermissions} onChange={setNewPermissions} />
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-2 rounded-lg border border-border-dim text-text-secondary hover:bg-bg-card-hover transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 btn-glow py-2">
                                    Create Template
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editTemplate && (
                <div className="modal-overlay">
                    <div className="glass-card w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
                        <h3 className="text-lg font-bold text-text-primary mb-4">
                            Edit Template: <span className="text-cyber-green">{editTemplate.name}</span>
                        </h3>
                        <form onSubmit={handleEdit} className="space-y-4">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Template Name</label>
                                <input
                                    type="text"
                                    value={editTemplate.name}
                                    onChange={(e) => setEditTemplate({ ...editTemplate, name: e.target.value })}
                                    className="input-cyber"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-text-secondary mb-2 uppercase tracking-wider">Permissions</label>
                                <PermissionTreeEditor
                                    permissions={editTemplate.permissions}
                                    onChange={(p) => setEditTemplate({ ...editTemplate, permissions: p })}
                                />
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => { setShowEditModal(false); setEditTemplate(null); }}
                                    className="flex-1 py-2 rounded-lg border border-border-dim text-text-secondary hover:bg-bg-card-hover transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 btn-glow py-2">
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
