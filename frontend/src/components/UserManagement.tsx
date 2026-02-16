import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';
import toast from 'react-hot-toast';

interface User {
    id: number;
    username: string;
    email: string;
    role: string;
    totp_enabled: boolean;
    acl_template_id: number | null;
    custom_acl_json: any;
    created_at: string;
}

interface ACLTemplate {
    id: number;
    name: string;
}

export default function UserManagement() {
    const [users, setUsers] = useState<User[]>([]);
    const [templates, setTemplates] = useState<ACLTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editUser, setEditUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'pentester',
    });
    const [editForm, setEditForm] = useState({
        email: '',
        role: '',
        acl_template_id: '' as string,
    });

    const fetchUsers = async () => {
        try {
            const res = await apiClient.get('/users');
            if (res.data.success) {
                setUsers(res.data.users);
            }
        } catch (err: any) {
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const fetchTemplates = async () => {
        try {
            const res = await apiClient.get('/acl/templates');
            if (res.data.success) {
                setTemplates(res.data.templates);
            }
        } catch {
            // Templates may not be available for non-sysadmin
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchTemplates();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await apiClient.post('/users', formData);
            if (res.data.success) {
                toast.success('User created successfully');
                setShowCreateModal(false);
                setFormData({ username: '', email: '', password: '', role: 'pentester' });
                fetchUsers();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to create user');
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editUser) return;
        try {
            const payload: any = {};
            if (editForm.email !== editUser.email) payload.email = editForm.email;
            if (editForm.role !== editUser.role) payload.role = editForm.role;
            const templateId = editForm.acl_template_id ? parseInt(editForm.acl_template_id, 10) : null;
            if (templateId !== editUser.acl_template_id) payload.acl_template_id = templateId;

            if (Object.keys(payload).length === 0) {
                toast('No changes to save');
                return;
            }

            const res = await apiClient.put(`/users/${editUser.id}`, payload);
            if (res.data.success) {
                toast.success('User updated — permissions will apply on their next request');
                setShowEditModal(false);
                setEditUser(null);
                fetchUsers();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update user');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            const res = await apiClient.delete(`/users/${id}`);
            if (res.data.success) {
                toast.success('User deleted');
                fetchUsers();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to delete user');
        }
    };

    const openEditModal = (user: User) => {
        setEditUser(user);
        setEditForm({
            email: user.email || '',
            role: user.role,
            acl_template_id: user.acl_template_id ? String(user.acl_template_id) : '',
        });
        setShowEditModal(true);
    };

    const getTemplateName = (id: number | null): string => {
        if (!id) return '—';
        const t = templates.find(t => t.id === id);
        return t ? t.name : `#${id}`;
    };

    return (
        <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border-dim flex justify-between items-center">
                <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <span className="text-cyber-green">👥</span> User Management
                </h2>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-glow px-3 py-1.5 text-xs"
                >
                    + Add User
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                    <thead className="bg-bg-card border-b border-border-dim text-text-muted uppercase tracking-wider">
                        <tr>
                            <th className="p-3 font-medium">ID</th>
                            <th className="p-3 font-medium">Username</th>
                            <th className="p-3 font-medium">Email</th>
                            <th className="p-3 font-medium">Role</th>
                            <th className="p-3 font-medium">ACL</th>
                            <th className="p-3 font-medium">2FA</th>
                            <th className="p-3 font-medium">Created</th>
                            <th className="p-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dim">
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-text-muted">Loading users...</td>
                            </tr>
                        ) : (
                            users.map((user) => (
                                <tr key={user.id} className="hover:bg-bg-card-hover transition-colors">
                                    <td className="p-3 text-text-secondary font-mono">{user.id}</td>
                                    <td className="p-3 text-text-primary font-medium">{user.username}</td>
                                    <td className="p-3 text-text-secondary">{user.email || '-'}</td>
                                    <td className="p-3">
                                        <span className={`badge ${user.role === 'sysadmin' ? 'badge-red' :
                                            user.role === 'admin' ? 'badge-yellow' : 'badge-green'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-3 text-text-muted text-[0.65rem]">
                                        {getTemplateName(user.acl_template_id)}
                                    </td>
                                    <td className="p-3">
                                        <span className={user.totp_enabled ? 'text-cyber-green' : 'text-text-muted'}>
                                            {user.totp_enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-text-muted">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openEditModal(user)}
                                                className="btn-outline !text-[0.6rem] !py-0.5 !px-2"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.id)}
                                                className="text-cyber-red hover:text-red-400 transition-colors bg-transparent border-0 cursor-pointer"
                                                title="Delete User"
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

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="glass-card w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-text-primary mb-4">Create New User</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Username *</label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="input-cyber"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="input-cyber"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Password *</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="input-cyber"
                                    placeholder="Min 12 chars, Upper, Lower, Number, Special"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Role *</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="input-cyber bg-bg-input"
                                >
                                    <option value="pentester">Pentester</option>
                                    <option value="admin">Admin</option>
                                    <option value="sysadmin">SysAdmin</option>
                                </select>
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
                                    Create User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && editUser && (
                <div className="modal-overlay">
                    <div className="glass-card w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-text-primary mb-1">
                            Edit User: <span className="text-cyber-green">{editUser.username}</span>
                        </h3>
                        <p className="text-xs text-text-muted mb-4">
                            Changes to role and ACL template apply dynamically on the user's next request.
                        </p>
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Email</label>
                                <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                    className="input-cyber"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Role</label>
                                <select
                                    value={editForm.role}
                                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                    className="input-cyber bg-bg-input"
                                >
                                    <option value="pentester">Pentester</option>
                                    <option value="admin">Admin</option>
                                    <option value="sysadmin">SysAdmin</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">ACL Template</label>
                                <select
                                    value={editForm.acl_template_id}
                                    onChange={(e) => setEditForm({ ...editForm, acl_template_id: e.target.value })}
                                    className="input-cyber bg-bg-input"
                                >
                                    <option value="">None (use role defaults)</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                                <p className="text-[0.6rem] text-text-muted mt-1">
                                    Assigning a template overrides role-based permissions for this user.
                                </p>
                            </div>

                            <div className="p-3 bg-cyber-green/5 border border-cyber-green/20 rounded-lg">
                                <p className="text-[0.65rem] text-text-secondary">
                                    <span className="text-cyber-green font-bold">⚡ Live Update:</span>{' '}
                                    Permission changes take effect immediately on the user's next API request.
                                    No logout/re-login required.
                                </p>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => { setShowEditModal(false); setEditUser(null); }}
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
