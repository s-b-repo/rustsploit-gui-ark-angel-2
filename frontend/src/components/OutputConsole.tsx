import { useState, useEffect, useRef } from 'react';
import apiClient from '../lib/apiClient';

interface Props {
    jobId: string | null;
}

export default function OutputConsole({ jobId }: Props) {
    const [output, setOutput] = useState('');
    const [status, setStatus] = useState<string>('idle');
    const scrollRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);

    useEffect(() => {
        if (!jobId) {
            setOutput('');
            setStatus('idle');
            return;
        }

        let isSubscribed = true;
        const interval = setInterval(async () => {
            try {
                const res = await apiClient.get(`/rsf/output/${jobId}`);
                if (isSubscribed && res.data.success) {
                    const data = res.data.data;
                    setOutput(data.output || '');
                    setStatus(data.status);

                    if (data.status === 'Completed' || data.status === 'Failed') {
                        clearInterval(interval);
                    }
                }
            } catch (err) {
                // Ignore errors during polling
            }
        }, 1000);

        return () => {
            isSubscribed = false;
            clearInterval(interval);
        };
    }, [jobId]);

    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [output, autoScroll]);

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 2;
        setAutoScroll(isAtBottom);
    };

    if (!jobId) {
        return (
            <div className="glass-card overflow-hidden h-full min-h-[300px] flex flex-col">
                {/* Header with terminal dots */}
                <div className="card-header card-header-green">
                    <div className="flex items-center gap-3">
                        <div className="terminal-dots">
                            <span className="dot-red" />
                            <span className="dot-yellow" />
                            <span className="dot-green" />
                        </div>
                        <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                            📺 Output Console
                        </h2>
                    </div>
                    <span className="badge badge-blue text-[0.6rem]">IDLE</span>
                </div>
                <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
                    <div className="text-center">
                        <div className="text-3xl opacity-20 mb-3">📺</div>
                        Waiting for job execution...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card overflow-hidden h-full min-h-[400px] flex flex-col">
            {/* Header with terminal dots */}
            <div className="card-header card-header-green">
                <div className="flex items-center gap-3">
                    <div className="terminal-dots">
                        <span className="dot-red" />
                        <span className="dot-yellow" />
                        <span className="dot-green" />
                    </div>
                    <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                        📺 Output Console
                    </h2>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted font-mono">{jobId.slice(0, 8)}</span>
                    <span
                        className={`badge ${status === 'Running'
                            ? 'badge-blue animate-pulse'
                            : status === 'Completed'
                                ? 'badge-green'
                                : status === 'Failed'
                                    ? 'badge-red'
                                    : 'badge-yellow'
                            } text-[0.6rem]`}
                    >
                        {status}
                    </span>
                </div>
            </div>
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 terminal-output m-4"
            >
                {output || <span className="text-text-muted italic">Initializing output stream...</span>}
                {status === 'Running' && <span className="cursor-blink">_</span>}
            </div>
        </div>
    );
}
