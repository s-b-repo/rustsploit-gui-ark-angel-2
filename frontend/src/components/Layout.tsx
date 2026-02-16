import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const NAV_ITEMS = [
    { id: 'dashboard', label: '⚡ Dashboard', path: '/', permission: null },
    { id: 'settings', label: '⚙️ Settings', path: '/settings', permission: null },
];

export default function Layout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <aside
                className={`${sidebarOpen ? 'w-64' : 'w-16'
                    } bg-bg-sidebar border-r border-border-dim flex flex-col transition-all duration-300`}
            >
                {/* Logo */}
                <div className="p-4 border-b border-border-dim flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyber-green to-cyber-green-dim flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
                        RS
                    </div>
                    {sidebarOpen && (
                        <div className="overflow-hidden">
                            <div className="text-sm font-bold text-cyber-green tracking-wider">RUSTSPLOIT</div>
                            <div className="text-[0.6rem] text-text-muted tracking-widest">COMMAND CENTER</div>
                        </div>
                    )}
                </div>

                {/* Nav items */}
                <nav className="flex-1 p-2 space-y-1">
                    {NAV_ITEMS.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 no-underline ${isActive
                                        ? 'bg-cyber-green/10 text-cyber-green border border-border-glow'
                                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-card border border-transparent'
                                    }`}
                            >
                                <span className="text-base flex-shrink-0">{item.label.split(' ')[0]}</span>
                                {sidebarOpen && <span>{item.label.split(' ').slice(1).join(' ')}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* User info & toggle */}
                <div className="p-3 border-t border-border-dim">
                    {sidebarOpen && user && (
                        <div className="mb-3 px-2">
                            <div className="text-xs font-bold text-text-primary">{user.username}</div>
                            <div className="text-[0.65rem] text-text-muted uppercase tracking-wider">{user.role}</div>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="flex-1 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-bg-card rounded-lg border border-border-dim hover:border-border-glow transition-all cursor-pointer"
                        >
                            {sidebarOpen ? '◀ Collapse' : '▶'}
                        </button>
                        {sidebarOpen && (
                            <button
                                onClick={handleLogout}
                                className="px-3 py-1.5 text-xs text-cyber-red hover:bg-cyber-red/10 rounded-lg border border-transparent hover:border-cyber-red/30 transition-all cursor-pointer"
                            >
                                Logout
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto bg-bg-primary">
                {/* Header */}
                <header className="sticky top-0 z-10 bg-bg-primary/80 backdrop-blur-xl border-b border-border-dim px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse-glow" />
                        <span className="text-sm text-text-secondary">
                            {location.pathname === '/' ? 'Dashboard' : location.pathname.slice(1).charAt(0).toUpperCase() + location.pathname.slice(2)}
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-text-muted font-mono">
                            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        {user && (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-bg-card border border-border-dim">
                                <div className="w-2 h-2 rounded-full bg-cyber-green" />
                                <span className="text-xs text-text-primary">{user.username}</span>
                                <span className="badge badge-green text-[0.6rem]">{user.role}</span>
                            </div>
                        )}
                    </div>
                </header>

                {/* Page content */}
                <div className="p-6">{children}</div>
            </main>
        </div>
    );
}
