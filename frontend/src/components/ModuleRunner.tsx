import { useState, useMemo } from 'react';
import apiClient from '../lib/apiClient';
import toast from 'react-hot-toast';

interface Props {
    selectedModule: string | null;
    onJobStarted: (jobId: string) => void;
}

type Category = 'exploits' | 'scanners' | 'creds' | 'camxploit' | 'unknown';

interface CategoryMeta {
    label: string;
    icon: string;
    color: string;
    accent: string;
    cssClass: string;
    headerClass: string;
    description: string;
}

const CATEGORY_MAP: Record<Category, CategoryMeta> = {
    exploits: {
        label: 'Exploit',
        icon: '💥',
        color: 'text-cyber-red',
        accent: 'border-cyber-red',
        cssClass: 'cat-exploit',
        headerClass: 'card-header-red',
        description: 'Execute exploit modules against the target. Configure target and optional parameters below.',
    },
    scanners: {
        label: 'Scanner',
        icon: '🔍',
        color: 'text-cyber-blue',
        accent: 'border-cyber-blue',
        cssClass: 'cat-scanner',
        headerClass: 'card-header-blue',
        description: 'Run reconnaissance and scanning modules to enumerate and discover services.',
    },
    creds: {
        label: 'Credential',
        icon: '🔑',
        color: 'text-cyber-yellow',
        accent: 'border-cyber-yellow',
        cssClass: 'cat-creds',
        headerClass: 'card-header-yellow',
        description: 'Bruteforce and credential testing modules. Configure wordlists and authentication parameters.',
    },
    camxploit: {
        label: 'CamXploit',
        icon: '📸',
        color: 'text-cyber-purple',
        accent: 'border-cyber-purple',
        cssClass: 'cat-camxploit',
        headerClass: 'card-header-purple',
        description: 'Autonomous camera exploitation. Scans ports, fingerprints devices, tests default credentials, and detects live streams — all automatically.',
    },
    unknown: {
        label: 'Module',
        icon: '📦',
        color: 'text-cyber-green',
        accent: 'border-cyber-green',
        cssClass: '',
        headerClass: 'card-header-green',
        description: 'Run the selected module against the target.',
    },
};

function detectCategory(modulePath: string): Category {
    if (modulePath.includes('camxploit')) return 'camxploit';
    if (modulePath.startsWith('exploits/')) return 'exploits';
    if (modulePath.startsWith('scanners/')) return 'scanners';
    if (modulePath.startsWith('creds/')) return 'creds';
    return 'unknown';
}

export default function ModuleRunner({ selectedModule, onJobStarted }: Props) {
    const [target, setTarget] = useState('');
    const [port, setPort] = useState('');
    const [concurrency, setConcurrency] = useState('10');
    const [timeout, setTimeout] = useState('');
    const [scanMethod, setScanMethod] = useState('');
    const [usernameWordlist, setUsernameWordlist] = useState('');
    const [passwordWordlist, setPasswordWordlist] = useState('');
    const [pathWordlist, setPathWordlist] = useState('');
    const [stopOnSuccess, setStopOnSuccess] = useState(false);
    const [comboMode, setComboMode] = useState(false);
    const [verbose, setVerbose] = useState(false);
    const [running, setRunning] = useState(false);
    const [customFields, setCustomFields] = useState<Record<string, string>>({});

    const category = useMemo(() => selectedModule ? detectCategory(selectedModule) : 'unknown', [selectedModule]);
    const meta = CATEGORY_MAP[category];

    const handleRun = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedModule || !target.trim()) {
            toast.error('Module and target are required');
            return;
        }
        setRunning(true);

        const payload: any = {
            module: selectedModule,
            target: target.trim(),
            ...(verbose ? { verbose: true } : {}),
        };

        if (category === 'exploits') {
            if (port) payload.port = parseInt(port, 10);
            if (timeout) payload.timeout = parseInt(timeout, 10);
            Object.entries(customFields).forEach(([key, value]) => {
                if (value.trim()) payload[key] = value.trim();
            });
        } else if (category === 'scanners') {
            if (concurrency) payload.concurrency = parseInt(concurrency, 10);
            if (timeout) payload.timeout = parseInt(timeout, 10);
            if (scanMethod) payload.scan_method = scanMethod;
        } else if (category === 'creds') {
            if (port) payload.port = parseInt(port, 10);
            if (concurrency) payload.concurrency = parseInt(concurrency, 10);
            if (usernameWordlist) payload.username_wordlist = usernameWordlist;
            if (passwordWordlist) payload.password_wordlist = passwordWordlist;
            if (pathWordlist) payload.path_wordlist = pathWordlist;
            if (stopOnSuccess) payload.stop_on_success = true;
            if (comboMode) payload.combo_mode = true;
        }

        try {
            const res = await apiClient.post('/rsf/run', payload);
            if (res.data.success && res.data.data?.job_id) {
                toast.success(`Job queued: ${res.data.data.job_id.substring(0, 8)}...`);
                onJobStarted(res.data.data.job_id);
            } else {
                toast.error(res.data.message || 'Failed to run module');
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to run module');
        } finally {
            setRunning(false);
        }
    };

    const addCustomField = () => {
        const name = prompt('Enter field name (e.g. rhost, lport, payload):');
        if (name && name.trim()) {
            setCustomFields(prev => ({ ...prev, [name.trim()]: '' }));
        }
    };

    const removeCustomField = (key: string) => {
        setCustomFields(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    if (!selectedModule) {
        return (
            <div className="glass-card p-8 text-center">
                <div className="text-4xl mb-4 opacity-20">⚡</div>
                <p className="text-text-muted text-sm">Select a module from the browser to configure and run it</p>
            </div>
        );
    }

    const moduleName = selectedModule.split('/').pop() || selectedModule;

    return (
        <div className={`glass-card overflow-hidden ${meta.cssClass}`}>
            {/* Gradient Header */}
            <div className={`card-header ${meta.headerClass}`}>
                <div className="flex items-center gap-3">
                    <span className="text-xl">{meta.icon}</span>
                    <div>
                        <span className={`badge ${category === 'exploits' ? 'badge-red' : category === 'scanners' ? 'badge-blue' : category === 'creds' ? 'badge-yellow' : category === 'camxploit' ? 'badge-purple' : 'badge-green'} text-[0.55rem]`}>
                            {meta.label}
                        </span>
                        <h2 className="text-sm font-bold text-text-primary mt-1 font-mono">{moduleName}</h2>
                    </div>
                </div>
                <div className="text-[0.6rem] text-text-muted font-mono bg-bg-input px-2 py-1 rounded border border-border-dim max-w-[200px] truncate">
                    {selectedModule}
                </div>
            </div>

            {/* Description */}
            <div className="px-5 py-3 border-b border-border-dim/50">
                <p className="text-xs text-text-muted leading-relaxed">{meta.description}</p>
            </div>

            {/* Form */}
            <form onSubmit={handleRun} className="p-5 space-y-4">
                {/* Target — always shown */}
                <div>
                    <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider font-semibold">
                        Target *
                    </label>
                    <input
                        type="text"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        className="input-cyber"
                        placeholder={category === 'camxploit'
                            ? 'IP address or 0.0.0.0 for mass scan'
                            : 'IP, Hostname, or CIDR (e.g. 192.168.1.0/24)'}
                        required
                    />
                </div>

                {/* ── EXPLOIT FORM ─────────── */}
                {category === 'exploits' && (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Port</label>
                                <input type="number" value={port} onChange={(e) => setPort(e.target.value)} className="input-cyber" placeholder="Default" />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Timeout (sec)</label>
                                <input type="number" value={timeout} onChange={(e) => setTimeout(e.target.value)} className="input-cyber" placeholder="30" />
                            </div>
                        </div>

                        {Object.keys(customFields).length > 0 && (
                            <div className="space-y-2 p-3 bg-bg-input rounded-lg border border-border-dim">
                                <div className="text-[0.65rem] text-text-muted uppercase tracking-wider mb-1">Custom Parameters</div>
                                {Object.entries(customFields).map(([key, value]) => (
                                    <div key={key} className="flex items-center gap-2">
                                        <span className="text-xs text-cyber-red font-mono w-24 truncate flex-shrink-0">{key}</span>
                                        <input
                                            type="text"
                                            value={value}
                                            onChange={(e) => setCustomFields(prev => ({ ...prev, [key]: e.target.value }))}
                                            className="input-cyber flex-1 !py-1.5 text-xs"
                                            placeholder={`Value for ${key}`}
                                        />
                                        <button type="button" onClick={() => removeCustomField(key)}
                                            className="text-cyber-red/60 hover:text-cyber-red text-xs bg-transparent border-0 cursor-pointer px-1">✕</button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button type="button" onClick={addCustomField}
                            className="btn-outline text-[0.65rem] !py-1 !px-2">
                            + Add Custom Field
                        </button>
                    </>
                )}

                {/* ── SCANNER FORM ─────────── */}
                {category === 'scanners' && (
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Concurrency</label>
                            <input type="number" value={concurrency} onChange={(e) => setConcurrency(e.target.value)} className="input-cyber" placeholder="10" />
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Timeout (sec)</label>
                            <input type="number" value={timeout} onChange={(e) => setTimeout(e.target.value)} className="input-cyber" placeholder="30" />
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Scan Method</label>
                            <select value={scanMethod} onChange={(e) => setScanMethod(e.target.value)} className="input-cyber bg-bg-input">
                                <option value="">Default</option>
                                <option value="syn">SYN Scan</option>
                                <option value="connect">Connect Scan</option>
                                <option value="udp">UDP Scan</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* ── CREDS / BRUTEFORCE FORM ─────────── */}
                {category === 'creds' && (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Port</label>
                                <input type="number" value={port} onChange={(e) => setPort(e.target.value)} className="input-cyber" placeholder="Default" />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Concurrency</label>
                                <input type="number" value={concurrency} onChange={(e) => setConcurrency(e.target.value)} className="input-cyber" placeholder="10" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Username Wordlist</label>
                                <input type="text" value={usernameWordlist} onChange={(e) => setUsernameWordlist(e.target.value)} className="input-cyber" placeholder="/path/to/usernames.txt" />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Password Wordlist</label>
                                <input type="text" value={passwordWordlist} onChange={(e) => setPasswordWordlist(e.target.value)} className="input-cyber" placeholder="/path/to/passwords.txt" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Path Wordlist</label>
                            <input type="text" value={pathWordlist} onChange={(e) => setPathWordlist(e.target.value)} className="input-cyber" placeholder="/path/to/paths.txt (optional)" />
                        </div>

                        <div className="flex flex-wrap items-center gap-6 py-2">
                            <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                                <div className="toggle-switch">
                                    <input type="checkbox" checked={stopOnSuccess} onChange={(e) => setStopOnSuccess(e.target.checked)} />
                                    <span className="toggle-slider" />
                                </div>
                                Stop on Success
                            </label>
                            <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                                <div className="toggle-switch">
                                    <input type="checkbox" checked={comboMode} onChange={(e) => setComboMode(e.target.checked)} />
                                    <span className="toggle-slider" />
                                </div>
                                Combo Mode
                            </label>
                        </div>
                    </>
                )}

                {/* ── CAMXPLOIT FORM ─────────── */}
                {category === 'camxploit' && (
                    <div className="p-4 bg-cyber-purple/5 border border-cyber-purple/20 rounded-lg">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">📸</span>
                            <div className="text-xs text-text-secondary space-y-2">
                                <p className="text-text-primary font-medium">Autonomous Camera Exploitation</p>
                                <p>CamXploit will automatically:</p>
                                <ul className="list-disc list-inside space-y-1 text-text-muted">
                                    <li>Scan {'>'} 200 common camera ports</li>
                                    <li>Fingerprint camera make/model via HTTP headers</li>
                                    <li>Test 80+ default credential pairs (HTTP + RTSP)</li>
                                    <li>Detect and enumerate live video streams</li>
                                    <li>Check login pages and admin panels</li>
                                </ul>
                                <p className="text-text-muted mt-2">
                                    Use <code className="text-cyber-purple bg-cyber-purple/10 px-1 rounded">0.0.0.0</code> as target for mass scan mode.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Verbose toggle — always shown */}
                <div className="flex items-center gap-6 py-2 border-t border-border-dim pt-4">
                    <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                        <div className="toggle-switch">
                            <input type="checkbox" checked={verbose} onChange={(e) => setVerbose(e.target.checked)} />
                            <span className="toggle-slider" />
                        </div>
                        Verbose Output
                    </label>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={running || !target.trim()}
                    className="btn-glow w-full text-sm py-3"
                >
                    {running ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin">⟳</span> Executing...
                        </span>
                    ) : (
                        <span>▶ Execute {meta.label}</span>
                    )}
                </button>
            </form>
        </div>
    );
}
