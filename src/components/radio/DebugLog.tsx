import { useEffect, useRef } from 'react';
import { useRadio } from '../../hooks/useRadio';
import { Card } from '../ui/Card';
import { Terminal, Trash2 } from '../ui/Icons';

export function DebugLog() {
    const { state, dispatch } = useRadio();
    const { logs } = state;
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [logs]);

    const handleClear = () => {
        dispatch({ type: 'CLEAR_LOGS' });
    };

    return (
        <Card className="col-span-12 min-h-[200px] flex flex-col bg-white border border-card-border shadow-sm rounded-3xl overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-b border-card-border">
                <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-secondary" />
                    <span className="text-[10px] font-mono font-bold text-secondary uppercase tracking-widest leading-none mt-0.5">Diagnostic Console</span>
                </div>
                <button
                    onClick={handleClear}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-white border border-card-border shadow-sm hover:bg-gray-50 active:translate-y-px transition-all"
                >
                    <Trash2 size={10} className="text-secondary" />
                    <span className="text-[9px] font-bold text-secondary uppercase tracking-wider">Clear</span>
                </button>
            </div>

            {/* Console Content */}
            <div
                ref={containerRef}
                className="flex-1 p-6 overflow-y-auto max-h-[250px] font-mono text-[11px] space-y-1.5 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent"
            >
                {logs.length === 0 && (
                    <div className="text-gray-400 italic opacity-50">-- No events logged --</div>
                )}
                {logs.map((log) => (
                    <div key={log.id} className="flex gap-4 border-b border-gray-50 pb-1 last:border-0">
                        <span className="text-gray-400 shrink-0 tabular-nums select-none opacity-70">
                            {log.ts.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className={`${log.level === 'error' ? 'text-red-600 font-bold' :
                            log.level === 'warn' ? 'text-amber-600 font-medium' :
                                'text-primary/90'
                            }`}>
                            {log.text}
                        </span>
                    </div>
                ))}
            </div>
        </Card>
    );
}
