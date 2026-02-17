import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useRsfHealthStore } from '../stores/rsfHealthStore';

const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', path: '/', icon: '⚡', permission: null },
    { id: 'settings', label: 'Settings', path: '/settings', icon: '⚙️', permission: null },
];

export default function Layout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const rsfHealth = useRsfHealthStore();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Determine banner color and icon based on status
    const getBannerStyle = () => {
        switch (rsfHealth.status) {
            case 'blocked':
                return { bg: 'bg-red-900/80', border: 'border-red-500/50', icon: '🚫', label: 'BLOCKED' };
            case 'auth_failed':
                return { bg: 'bg-yellow-900/80', border: 'border-yellow-500/50', icon: '🔑', label: 'AUTH FAILED' };
            case 'offline':
                return { bg: 'bg-red-900/80', border: 'border-red-500/50', icon: '💀', label: 'OFFLINE' };
            case 'timeout':
                return { bg: 'bg-orange-900/80', border: 'border-orange-500/50', icon: '⏱️', label: 'TIMEOUT' };
            default:
                return { bg: 'bg-yellow-900/80', border: 'border-yellow-500/50', icon: '⚠️', label: 'DEGRADED' };
        }
    };

    const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <aside
                className={`${sidebarOpen ? 'w-64' : 'w-16'
                    } bg-bg-sidebar border-r border-border-dim flex flex-col transition-all duration-300`}
            >
                {/* Logo */}
                <div className="sidebar-logo-area p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyber-green to-cyber-green-dim flex items-center justify-center text-black font-bold text-sm flex-shrink-0 shadow-[0_0_15px_rgba(0,255,65,0.2)]">
                        RS
                    </div>
                    {sidebarOpen && (
                        <div className="overflow-hidden">
                            <div className="text-sm font-bold text-cyber-green tracking-wider">RUSTSPLOIT</div>
                            <div className="text-[0.55rem] text-text-muted tracking-[0.2em]">COMMAND CENTER</div>
                        </div>
                    )}
                </div>

                {/* Nav items */}
                <nav className="flex-1 p-2 space-y-1 mt-2">
                    {sidebarOpen && (
                        <div className="text-[0.55rem] text-text-muted uppercase tracking-[0.15em] px-3 mb-2 font-semibold">Navigation</div>
                    )}
                    {NAV_ITEMS.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 no-underline ${isActive
                                    ? 'sidebar-nav-active font-semibold'
                                    : 'sidebar-nav-item text-text-secondary hover:text-text-primary'
                                    }`}
                            >
                                <span className="text-base flex-shrink-0">{item.icon}</span>
                                {sidebarOpen && <span>{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* User info & toggle */}
                <div className="p-3 border-t border-border-dim">
                    {sidebarOpen && user && (
                        <div className="mb-3 px-1 flex items-center gap-3">
                            <div className="avatar-circle">{getInitials(user.username)}</div>
                            <div className="overflow-hidden">
                                <div className="text-xs font-bold text-text-primary truncate">{user.username}</div>
                                <div className="text-[0.6rem] text-text-muted uppercase tracking-wider">{user.role}</div>
                            </div>
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
                                className="px-3 py-1.5 text-xs text-cyber-red hover:bg-cyber-red/10 rounded-lg border border-transparent hover:border-cyber-red/30 transition-all cursor-pointer bg-transparent"
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
                <header className="sticky top-0 z-10 bg-bg-primary/80 backdrop-blur-xl border-b border-border-dim px-6 py-3 flex items-center justify-between relative scan-line-overlay">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className={`w-2 h-2 rounded-full ${rsfHealth.status === 'connected' || rsfHealth.status === 'unknown'
                            ? 'bg-cyber-green animate-pulse-glow'
                            : rsfHealth.status === 'auth_failed' || rsfHealth.status === 'blocked'
                                ? 'bg-red-500 animate-pulse'
                                : 'bg-yellow-500 animate-pulse'
                            }`} />
                        <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                            <span className="text-text-muted">›</span>
                            <span>{location.pathname === '/' ? 'Dashboard' : location.pathname.slice(1).charAt(0).toUpperCase() + location.pathname.slice(2)}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 relative z-10">
                        <span className="text-xs text-text-muted font-mono">
                            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        {user && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-card border border-border-dim hover:border-border-glow transition-colors">
                                <div className="w-2 h-2 rounded-full bg-cyber-green" />
                                <span className="text-xs text-text-primary font-medium">{user.username}</span>
                                <span className="badge badge-green text-[0.55rem]">{user.role}</span>
                            </div>
                        )}
                    </div>
                </header>

                {/* RSF Degraded/Blocked Banner */}
                {rsfHealth.showBanner && rsfHealth.failureCount >= 3 && (() => {
                    const style = getBannerStyle();
                    return (
                        <div className={`mx-6 mt-3 ${style.bg} ${style.border} border rounded-lg px-4 py-3 flex items-center justify-between animate-pulse-glow`}>
                            <div className="flex items-center gap-3">
                                <span className="text-lg">{style.icon}</span>
                                <div>
                                    <div className="text-xs font-bold text-white tracking-wider">
                                        RSF API {style.label}
                                    </div>
                                    <div className="text-[0.65rem] text-white/70 mt-0.5">
                                        {rsfHealth.message}
                                        {rsfHealth.failureCount > 0 && ` (${rsfHealth.failureCount} consecutive failures)`}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {user?.role === 'sysadmin' && (
                                    <Link
                                        to="/settings"
                                        className="px-3 py-1 text-[0.65rem] font-bold bg-white/10 hover:bg-white/20 text-white rounded-md border border-white/20 no-underline transition-colors"
                                    >
                                        🔑 Update API Key
                                    </Link>
                                )}
                                <button
                                    onClick={rsfHealth.dismissBanner}
                                    className="px-2 py-1 text-white/50 hover:text-white bg-transparent border-0 cursor-pointer text-xs"
                                    title="Dismiss"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    );
                })()}

                {/* Page content */}
                <div className="p-6">{children}</div>
            </main>
        </div>
    );
}

