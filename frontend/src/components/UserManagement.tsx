import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';
import toast from 'react-hot-toast';

interface User {
    id: number;
    username: string;
    role: string;
    acl_template_id: number | null;
    totp_enabled: boolean;
    created_at: string;
}

interface AclTemplate {
    id: number;
    name: string;
}

export default function UserManagement() {
    const [users, setUsers] = useState<User[]>([]);
    const [templates, setTemplates] = useState<AclTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editUser, setEditUser] = useState<User | null>(null);

    // Form state
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('pentester');
    const [aclTemplateId, setAclTemplateId] = useState<number | null>(null);

    const fetchAll = async () => {
        try {
            const [usersRes, tplRes] = await Promise.all([
                apiClient.get('/users'),
                apiClient.get('/acl/templates'),
            ]);
            if (usersRes.data.success) setUsers(usersRes.data.users || usersRes.data.data || []);
            if (tplRes.data.success) setTemplates(tplRes.data.templates || tplRes.data.data || []);
        } catch {
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const openCreate = () => {
        setEditUser(null);
        setUsername('');
        setPassword('');
        setRole('pentester');
        setAclTemplateId(null);
        setShowModal(true);
    };

    const openEdit = (user: User) => {
        setEditUser(user);
        setUsername(user.username);
        setPassword('');
        setRole(user.role);
        setAclTemplateId(user.acl_template_id);
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editUser) {
                const payload: any = { role };
                if (password) payload.password = password;
                if (aclTemplateId) payload.acl_template_id = aclTemplateId;
                const res = await apiClient.put(`/users/${editUser.id}`, payload);
                if (res.data.success) toast.success('User updated');
                else toast.error(res.data.message || 'Update failed');
            } else {
                const payload: any = { username, password, role };
                if (aclTemplateId) payload.acl_template_id = aclTemplateId;
                const res = await apiClient.post('/users', payload);
                if (res.data.success) toast.success('User created');
                else toast.error(res.data.message || 'Creation failed');
            }
            setShowModal(false);
            fetchAll();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Operation failed');
        }
    };

    const handleDelete = async (user: User) => {
        if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
        try {
            const res = await apiClient.delete(`/users/${user.id}`);
            if (res.data.success) {
                toast.success('User deleted');
                fetchAll();
            } else {
                toast.error(res.data.message || 'Delete failed');
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Delete failed');
        }
    };

    return (
        <>
            <div className="glass-card overflow-hidden">
                {/* Gradient header */}
                <div className="card-header card-header-purple">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                            <span className="text-cyber-purple">👥</span> User Management
                        </h2>
                        <span className="badge badge-purple text-[0.6rem]">{users.length} users</span>
                    </div>
                    <button onClick={openCreate} className="btn-glow text-xs !py-1.5 !px-4">
                        + Create User
                    </button>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-text-muted text-xs animate-pulse">Loading users...</div>
                ) : users.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="text-3xl mb-3 opacity-20">👥</div>
                        <p className="text-text-muted text-xs">No users found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table-premium">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Role</th>
                                    <th>ACL Template</th>
                                    <th>2FA</th>
                                    <th>Created</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td className="text-text-primary font-semibold">{user.username}</td>
                                        <td>
                                            <span className={`badge ${user.role === 'sysadmin' ? 'badge-red' : user.role === 'admin' ? 'badge-yellow' : user.role === 'operator' ? 'badge-blue' : user.role === 'readonly' ? 'badge-purple' : 'badge-green'} text-[0.6rem]`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="text-text-secondary text-[0.7rem]">
                                            {templates.find(t => t.id === user.acl_template_id)?.name || '-'}
                                        </td>
                                        <td>
                                            <span className={`w-2 h-2 rounded-full inline-block ${user.totp_enabled ? 'bg-cyber-green' : 'bg-text-muted'}`} />
                                        </td>
                                        <td className="text-text-muted text-[0.65rem]">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center gap-1.5 justify-end">
                                                <button onClick={() => openEdit(user)} className="btn-outline text-[0.6rem] !px-2 !py-0.5">
                                                    ✏️ Edit
                                                </button>
                                                <button onClick={() => handleDelete(user)}
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
                    <div className="glass-card w-full max-w-md overflow-hidden">
                        <div className={`card-header ${editUser ? 'card-header-blue' : 'card-header-green'}`}>
                            <h3 className="text-sm font-bold text-text-primary">
                                {editUser ? '✏️ Edit User' : '➕ Create User'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-text-muted hover:text-text-primary text-sm bg-transparent border-0 cursor-pointer">✕</button>
                        </div>
                        <form onSubmit={handleSave} className="p-5 space-y-4">
                            {!editUser && (
                                <div>
                                    <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider font-semibold">Username</label>
                                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="input-cyber" required />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider font-semibold">
                                    {editUser ? 'New Password (leave blank to keep)' : 'Password'}
                                </label>
                                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-cyber" {...(!editUser ? { required: true } : {})} />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider font-semibold">Role</label>
                                <select value={role} onChange={(e) => setRole(e.target.value)} className="input-cyber bg-bg-input">
                                    <option value="readonly">Read Only</option>
                                    <option value="pentester">Pentester</option>
                                    <option value="operator">Operator</option>
                                    <option value="admin">Admin</option>
                                    <option value="sysadmin">Sysadmin</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider font-semibold">ACL Template</label>
                                <select value={aclTemplateId || ''} onChange={(e) => setAclTemplateId(e.target.value ? parseInt(e.target.value) : null)} className="input-cyber bg-bg-input">
                                    <option value="">None</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" className="btn-glow flex-1">
                                    {editUser ? 'Save Changes' : 'Create User'}
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
