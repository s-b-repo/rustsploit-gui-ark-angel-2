import { useState } from 'react';
import UserManagement from './UserManagement';
import ACLManager from './ACLManager';

type SubTab = 'users' | 'acl' | 'roles';

const ROLE_HIERARCHY = [
    {
        role: 'sysadmin',
        label: 'Sysadmin',
        color: 'badge-red',
        description: 'Full system access. Can manage all users, ACL templates, and RSF API settings.',
        permissions: 'All permissions granted',
    },
    {
        role: 'admin',
        label: 'Admin',
        color: 'badge-yellow',
        description: 'User management + full operational access. Cannot manage ACL templates.',
        permissions: 'modules (view, run), jobs (view, kill), target (view, set), status, users (manage)',
    },
    {
        role: 'operator',
        label: 'Operator',
        color: 'badge-blue',
        description: 'Full operational access. Cannot manage users or ACL.',
        permissions: 'modules (view, run), jobs (view, kill), target (view, set), status',
    },
    {
        role: 'pentester',
        label: 'Pentester',
        color: 'badge-green',
        description: 'Default role. Same as operator, uses ACL template for fine-grained control.',
        permissions: 'modules (view, run), jobs (view), target (view, set), status',
    },
    {
        role: 'readonly',
        label: 'Read Only',
        color: 'badge-purple',
        description: 'View-only access. Cannot execute modules, kill jobs, or set targets.',
        permissions: 'modules (view), jobs (view), target (view), status (view)',
    },
];

export default function UserAdminPanel() {
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('users');

    const subTabs: { id: SubTab; label: string; icon: string }[] = [
        { id: 'users', label: 'Users', icon: '👥' },
        { id: 'acl', label: 'ACL Templates', icon: '🔒' },
        { id: 'roles', label: 'Roles', icon: '🛡️' },
    ];

    return (
        <div className="space-y-4">
            {/* Sub-tab navigation */}
            <div className="flex gap-2 bg-bg-input/40 rounded-xl p-1.5 border border-border-dim">
                {subTabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold transition-all duration-200 border-0 cursor-pointer ${activeSubTab === tab.id
                                ? 'bg-gradient-to-r from-cyber-green/15 to-cyber-blue/10 text-cyber-green shadow-md border border-cyber-green/30'
                                : 'bg-transparent text-text-muted hover:text-text-secondary hover:bg-bg-input/60'
                            }`}
                        style={activeSubTab === tab.id ? { border: '1px solid rgba(0,255,65,0.3)' } : {}}
                    >
                        <span>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Sub-tab content */}
            {activeSubTab === 'users' && <UserManagement />}
            {activeSubTab === 'acl' && <ACLManager />}
            {activeSubTab === 'roles' && (
                <div className="glass-card overflow-hidden">
                    <div className="card-header card-header-blue">
                        <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                            <span className="text-cyber-blue">🛡️</span> Role Hierarchy & Permissions
                        </h2>
                    </div>
                    <div className="p-5 space-y-3">
                        <p className="text-xs text-text-muted mb-4">
                            Roles define the base permission level. ACL templates can override these for fine-grained control.
                        </p>
                        {ROLE_HIERARCHY.map((r, i) => (
                            <div key={r.role} className="bg-bg-input rounded-xl p-4 border border-border-dim hover:border-border-dim/80 transition-colors">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-xs text-text-muted font-mono w-5 text-right">{i + 1}.</span>
                                    <span className={`badge ${r.color} text-[0.6rem]`}>{r.label}</span>
                                </div>
                                <p className="text-xs text-text-secondary ml-8 mb-1.5">{r.description}</p>
                                <div className="text-[0.65rem] text-text-muted ml-8 font-mono bg-bg-surface/40 rounded px-2 py-1 inline-block">
                                    {r.permissions}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
