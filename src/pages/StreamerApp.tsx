import { RadioProvider } from '../context/RadioProvider';
import { useRadio, useAudioEngine } from '../hooks/useRadio';
import { useAudioReal } from '../hooks/useAudioReal';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Sliders, Bell, Headphones, Zap, Search, ChevronRight } from '../components/ui/Icons';
import { cn } from '../lib/utils';
import { Header } from '../components/layout/Header';
import { SpotifyService, hasSpotifyClientId } from '../lib/spotify';
import { SpotifyPlaylist, Track, LogEntry, LogType, WalletEntry } from '../types/radio';

/* ═══════════════════════════════════════════════════════════════
   PREMIUM STUDIO COMPONENTS (Architectural Precision)
   ═══════════════════════════════════════════════════════════════ */

/* ─── Spectral Visualizer (Canvas Driven) ─── */
function SpectralVisualizer({ isPlaying }: { isPlaying: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioFrame = useAudioReal();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const render = () => {
            const width = canvas.width;
            const height = canvas.height;
            ctx.clearRect(0, 0, width, height);

            if (isPlaying) {
                // Draw Frequency Bars
                const bars = audioFrame.amplitude;
                const barWidth = width / bars.length;

                ctx.beginPath();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#ff2d55';

                bars.forEach((amp, i) => {
                    const x = i * barWidth;
                    const h = amp * height * 0.8;
                    const y = height / 2;

                    ctx.moveTo(x, y - h / 2);
                    ctx.lineTo(x, y + h / 2);
                });
                ctx.stroke();

                // Draw Waveform Line (overlay)
                const wave = audioFrame.waveform;
                ctx.beginPath();
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';

                const waveStep = width / wave.length;
                wave.forEach((p, i) => {
                    const x = i * waveStep;
                    const y = height / 2 + p * height * 0.3;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                ctx.stroke();

                // Subtle Glow
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(255, 45, 85, 0.4)';
            } else {
                ctx.beginPath();
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.moveTo(0, height / 2);
                ctx.lineTo(width, height / 2);
                ctx.stroke();
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [isPlaying, audioFrame]);

    return (
        <div className="absolute inset-0 bg-black flex items-center justify-center p-8 overflow-hidden rounded-2xl hardware-inset">
            <canvas ref={canvasRef} width={800} height={400} className="w-full h-full opacity-60" />
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black via-transparent to-black" />
        </div>
    );
}

/* ─── LED Signal Level ─── */
function SignalLevel({ label, type }: { label: string, type: 'left' | 'right' | 'mono' }) {
    const frame = useAudioReal();
    const isPlaying = frame.amplitude.length > 0;

    // Get peak value from the corresponding frequency bins
    // Left: Low-Mid, Right: Mid-High, Mono: Peak
    let peak = 0;
    if (isPlaying) {
        if (type === 'left') peak = Math.max(...frame.amplitude.slice(0, 40));
        else if (type === 'right') peak = Math.max(...frame.amplitude.slice(40, 80));
        else peak = Math.max(...frame.amplitude.slice(0, 10)); // Punchy mono peak
    }

    return (
        <div className="flex flex-col gap-2 w-full">
            <div className="flex justify-between items-baseline px-0.5">
                <span className="text-[9px] font-black tracking-[0.3em] uppercase text-white/70">{label}</span>
                <span className="text-[10px] font-mono font-medium text-white/55">{(peak * 10 * -1).toFixed(1)} dB</span>
            </div>
            <div className="h-[3px] w-full bg-white/5 rounded-full overflow-hidden flex gap-[2px]">
                <motion.div
                    animate={{ width: isPlaying ? `${peak * 100}%` : '0%' }}
                    transition={{ duration: 0.05 }}
                    className={cn(
                        "h-full rounded-full transition-all",
                        peak > 0.8 ? "bg-accent" : peak > 0.6 ? "bg-amber-400" : "bg-white/40"
                    )}
                />
            </div>
        </div>
    );
}

/* ─── Studio Fader ─── */
function StudioFader({ id, label, value, onDoubleClick, className }: { id: string; label: string; value: number; onDoubleClick: () => void; className?: string }) {
    const { dispatch } = useRadio();
    // Default for Tempo is roughly 0.5 (120bpm), others are 1.0
    const isModified = id === 'bpm' ? Math.round(value * 100) !== 50 : Math.round(value * 100) !== 100;

    return (
        <div className={cn("flex flex-col items-center gap-6 group py-4", className)}>
            <div className="flex flex-col items-center gap-1">
                <span className={cn("text-[9px] font-black tracking-[0.2em] uppercase transition-colors", isModified ? "text-accent" : "text-white/55")}>
                    {label}
                </span>
                <span className="text-[10px] font-mono font-bold text-white/35 tabular-nums">
                    {Math.round(value * 100)}%
                </span>
            </div>

            <div className="relative h-48 w-8 flex justify-center">
                {/* Visual Rail */}
                <div className="absolute inset-y-0 w-[2px] bg-white/[0.03] rounded-full" />

                {/* Center Point Indicator (Normalization) */}
                <div className="absolute bottom-1/2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/10 z-0" />

                {/* Level Scale */}
                <div className="absolute inset-y-0 -left-6 flex flex-col justify-between py-1 pointer-events-none opacity-10">
                    {[12, 6, 0, -6, -24, '-∞'].map(m => <span key={m.toString()} className="text-[9px] font-mono text-white">{m}</span>)}
                </div>

                <input
                    type="range" min="0" max="1" step="0.01"
                    value={value}
                    onDoubleClick={onDoubleClick}
                    onChange={(e) => {
                        const val = Number(e.target.value);
                        if (id === 'bpm') dispatch({ type: 'UPDATE_PARAMS', payload: { bpm: val * 120 + 60 } });
                        else dispatch({ type: 'UPDATE_PARAMS', payload: { [id]: val } });
                    }}
                    title="Double-click to reset"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize z-10 [appearance:slider-vertical]"
                />

                {/* Precision Thumb */}
                <motion.div
                    className={cn(
                        "absolute w-12 h-10 bg-[#151515] border border-white/10 rounded-sm flex flex-col items-center justify-center gap-[2px] pointer-events-none shadow-2xl",
                        isModified && "border-accent/40 bg-accent/5"
                    )}
                    style={{ bottom: `calc(${value * 100}% - 20px)` }}
                >
                    <div className="w-8 h-[1px] bg-white/5" />
                    <div className={cn("w-full h-[4px] shadow-inner", isModified ? 'bg-accent' : 'bg-white/10')} />
                    <div className="w-8 h-[1px] bg-white/5" />
                </motion.div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   SOURCE LINKER MODAL
   ═══════════════════════════════════════════════════════════════ */

function SourceLinkerModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { dispatch } = useRadio();
    const spotifyToken = localStorage.getItem('spotify_access_token');
    const [step, setStep] = useState<'source' | 'search' | 'connecting' | 'importing'>('source');
    const [selectedSource, setSelectedSource] = useState<string | null>(null);
    const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [importingId, setImportingId] = useState<string | null>(null);

    const sources = [
        { id: 'spotify', name: 'Spotify', icon: '💿' },
        { id: 'apple', name: 'Apple Music', icon: '🍎' },
        { id: 'youtube', name: 'YouTube Music', icon: '▶️' },
        { id: 'local', name: 'Local Folder', icon: '📁' }
    ];

    const handleSelectSource = async (id: string) => {
        setSelectedSource(id);
        if (id === 'spotify') {
            if (spotifyToken) {
                setStep('connecting');
                try {
                    const fetched = await SpotifyService.fetchPlaylists(spotifyToken);
                    setPlaylists(fetched);
                    setStep('search');
                } catch (err) {
                    console.error('Failed to load Spotify playlists:', err);
                    // Token might be expired — show source selection, don't auto-reauth
                    localStorage.removeItem('spotify_access_token');
                    setStep('source');
                }
            } else {
                await SpotifyService.authorize();
            }
        } else if (id === 'local') {
            onClose();
            window.dispatchEvent(new CustomEvent('trigger-folder-ingest'));
        } else {
            setStep('connecting');
            setTimeout(() => setStep('search'), 1500);
        }
    };

    useEffect(() => {
        if (selectedSource === 'spotify' && searchQuery.length > 2 && spotifyToken) {
            const timeout = setTimeout(() => {
                SpotifyService.searchPlaylists(spotifyToken, searchQuery)
                    .then(setPlaylists)
                    .catch(console.error);
            }, 500);
            return () => clearTimeout(timeout);
        }
    }, [searchQuery, selectedSource, spotifyToken]);

    const filteredPlaylists = playlists.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelectPlaylist = async (playlist: SpotifyPlaylist) => {
        if (!spotifyToken) return;
        setImportingId(playlist.id);
        setStep('importing');
        dispatch({ type: 'ADD_LOG', text: `Importing "${playlist.name}" from Spotify...` });

        try {
            const spotifyTracks = await SpotifyService.fetchPlaylistTracks(spotifyToken, playlist.id);
            console.log('[Spotify Debug] Received tracks from service:', spotifyTracks.length);

            const tracks: Track[] = spotifyTracks.map(t => ({
                id: t.id,
                instanceId: `${t.id}-${Math.random().toString(36).substr(2, 9)}`,
                title: t.title,
                artist: t.artist,
                bpm: 120,
                url: t.url
            }));

            console.log('[Spotify Debug] Dispatching tracks to library/playlist:', tracks.length);
            dispatch({ type: 'CREATE_PLAYLIST', name: playlist.name, tracks });
            dispatch({ type: 'ADD_TO_LIBRARY', tracks });
            dispatch({ type: 'ADD_LOG', text: `✅ Imported "${playlist.name}" — ${tracks.length} tracks added to library` });

            setImportingId(null);
            onClose();
        } catch (err) {
            console.error('Import failed:', err);
            const errorMsg = err instanceof Error ? err.message : String(err);
            dispatch({ type: 'ADD_LOG', text: `Failed to import "${playlist.name}": ${errorMsg}`, level: 'error' });
            setImportingId(null);
            setStep('search');
        }
    };

    // Auto-fetch logic removed to prevent loops. 
    // User must click the Spotify card to browse their library.

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-md">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="w-full max-w-2xl bg-[#080808] border border-white/5 rounded-3xl overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)]"
                    >
                        <div className="p-8 border-b border-white/5 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <h2 className="text-[10px] font-black tracking-[0.5em] uppercase text-white/85">Music Source Ingest</h2>
                                <p className="text-[8px] font-mono text-accent/60 uppercase">
                                    {spotifyToken ? 'SPOTIFY: CONNECTED' : 'DDS-LINK NODE: READY'}
                                </p>
                            </div>
                            <button onClick={onClose} className="text-white/55 hover:text-white transition-colors">✕</button>
                        </div>

                        <div className="p-12 min-h-[400px] flex flex-col justify-center">
                            {step === 'source' && (
                                <div className="grid grid-cols-2 gap-4">
                                    {sources.map(s => (
                                        <div className="relative group">
                                            <button
                                                key={s.id}
                                                onClick={() => handleSelectSource(s.id)}
                                                className="w-full group flex flex-col items-start p-8 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 transition-all text-left relative"
                                            >
                                                {s.id === 'spotify' && spotifyToken && (
                                                    <div className="absolute top-4 right-4 text-[9px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20 tracking-widest uppercase">Connected</div>
                                                )}
                                                {s.id === 'spotify' && !hasSpotifyClientId && !spotifyToken && (
                                                    <div className="absolute top-4 right-4 text-[9px] font-black text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20 tracking-widest uppercase">Setup Required</div>
                                                )}
                                                <span className="text-3xl mb-6 grayscale group-hover:grayscale-0 transition-all">{s.icon}</span>
                                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 group-hover:text-white transition-colors">{s.name}</span>
                                                <span className="text-[8px] font-bold text-white/35 uppercase mt-2">
                                                    {s.id === 'spotify' && spotifyToken ? 'Browse Library' : 'Connect Account'}
                                                </span>
                                            </button>
                                            {s.id === 'spotify' && spotifyToken && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); localStorage.removeItem('spotify_access_token'); window.location.reload(); }}
                                                    className="absolute bottom-4 right-4 text-[8px] font-black uppercase tracking-widest text-white/20 hover:text-red-400 transition-colors bg-white/5 px-2 py-1 rounded-md"
                                                >
                                                    Disconnect
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {step === 'connecting' && (
                                <div className="flex flex-col items-center gap-8 py-12">
                                    <div className="w-16 h-16 rounded-full border border-accent/20 flex items-center justify-center relative">
                                        <div className="absolute inset-0 rounded-full border-t border-accent animate-spin" />
                                        <Zap className="text-accent" size={24} />
                                    </div>
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="text-sm font-bold text-white uppercase tracking-widest">Loading your library...</span>
                                        <span className="text-[8px] font-mono text-white/55 uppercase tracking-[0.4em]">Fetching playlists from Spotify</span>
                                    </div>
                                </div>
                            )}

                            {step === 'importing' && (
                                <div className="flex flex-col items-center gap-8 py-12">
                                    <div className="w-16 h-16 rounded-full border border-emerald-400/20 flex items-center justify-center relative">
                                        <div className="absolute inset-0 rounded-full border-t border-emerald-400 animate-spin" />
                                        <span className="text-2xl">🎵</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="text-sm font-bold text-white uppercase tracking-widest">Importing tracks...</span>
                                        <span className="text-[8px] font-mono text-emerald-400/60 uppercase tracking-[0.4em]">Fetching preview URLs</span>
                                    </div>
                                </div>
                            )}

                            {step === 'search' && (
                                <div className="flex flex-col gap-8">
                                    <div className="relative">
                                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/55" size={16} />
                                        <input
                                            autoFocus
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="SEARCH YOUR SPOTIFY LIBRARY..."
                                            className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-6 pl-16 pr-8 text-sm font-medium text-white placeholder:text-white/35 outline-none focus:border-accent/40 transition-all"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/35 ml-2">
                                            Your Playlists ({filteredPlaylists.length})
                                        </span>
                                        {filteredPlaylists.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => handleSelectPlaylist(p)}
                                                disabled={importingId === p.id}
                                                className="flex items-center justify-between p-5 rounded-xl border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03] transition-all group disabled:opacity-50"
                                            >
                                                <div className="flex items-center gap-4">
                                                    {p.imageUrl ? (
                                                        <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-white/55 font-bold text-xs uppercase">{p.name.charAt(0)}</div>
                                                    )}
                                                    <div className="flex flex-col items-start gap-1 text-left">
                                                        <span className="text-xs font-bold text-white/60 tracking-tight group-hover:text-white transition-colors">{p.name}</span>
                                                        {p.tracksCount > 0 ? <span className="text-[8px] font-mono text-white/55 uppercase">{p.tracksCount} Tracks</span> : null}
                                                    </div>
                                                </div>
                                                <ChevronRight size={14} className="text-white/35 group-hover:text-accent group-hover:translate-x-1 transition-all" />
                                            </button>
                                        ))}
                                        {filteredPlaylists.length === 0 && (
                                            <div className="py-12 flex flex-col items-center gap-2">
                                                <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">No playlists found</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-8 bg-black/40 border-t border-white/5 flex justify-between items-center text-[8px] font-mono font-bold text-white/35 uppercase tracking-[0.3em]">
                            <span>Status: {spotifyToken ? 'AUTHENTICATED' : 'AWAITING_AUTH'}</span>
                            <button
                                onClick={() => { setStep('source'); setPlaylists([]); setSearchQuery(''); }}
                                className="hover:text-accent transition-colors"
                            >
                                ← Back to Sources
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}




// ─── GO LIVE COUNTDOWN ─── */
function GoLiveCountdown({ onComplete }: { onComplete: () => void }) {
    const [count, setCount] = useState(3);

    useEffect(() => {
        if (count === 0) {
            onComplete();
            return;
        }
        const timer = setTimeout(() => setCount(count - 1), 1000);
        return () => clearTimeout(timer);
    }, [count, onComplete]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm"
        >
            <div className="text-[120px] font-black tracking-tighter text-accent italic">
                {count}
            </div>
        </motion.div>
    );
}

/* ─── INTERACTION FEED (Signal Stream) ─── */
function InteractionFeed() {
    const { state } = useRadio();
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [state.logs]);

    const interactionLogs = state.logs.filter(log =>
        log.type === 'FAN_REACTION' || log.type === 'FAN_COMMENT' || log.type === 'SYSTEM'
    );

    return (
        <div className="absolute bottom-4 left-4 w-72 h-48 pointer-events-none z-20 flex flex-col justify-end">
            <div
                ref={scrollRef}
                className="overflow-y-auto custom-scrollbar pointer-events-auto flex flex-col gap-2 p-2"
                style={{
                    maxHeight: '100%',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%)'
                }}
            >
                {interactionLogs.map((log) => (
                    <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                            "px-3 py-2 rounded-sm border backdrop-blur-md transition-all flex flex-col gap-1",
                            log.type === 'SYSTEM'
                                ? "bg-white/[0.02] border-white/5"
                                : "bg-accent/5 border-accent/20"
                        )}
                    >
                        <div className="flex justify-between items-center gap-4">
                            <span className={cn(
                                "text-[7px] font-black uppercase tracking-widest truncate",
                                log.type === 'SYSTEM' ? "text-white/30" : "text-accent/60"
                            )}>
                                {log.type === 'SYSTEM' ? 'Engine Signal' : log.user || 'Anonymous'}
                            </span>
                            <span className="text-[6px] font-mono text-white/20 whitespace-nowrap">
                                {new Date(log.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        </div>
                        <p className={cn(
                            "text-[10px] leading-tight font-medium",
                            log.type === 'SYSTEM' ? "text-white/60" : "text-white/90"
                        )}>
                            {log.text}
                        </p>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

/* ─── HYPE ALERT (Gifts & Big Events) ─── */
function HypeAlert() {
    const { state } = useRadio();
    const [activeAlert, setActiveAlert] = useState<LogEntry | null>(null);
    const lastHandledId = useRef<string | null>(null);

    useEffect(() => {
        const lastLog = state.logs[state.logs.length - 1];
        if (lastLog?.type === 'FAN_GIFT' && lastLog.id !== lastHandledId.current) {
            lastHandledId.current = lastLog.id;
            // Delay to avoid cascading render lint
            const alertTimer = setTimeout(() => setActiveAlert(lastLog), 0);
            const clearTimer = setTimeout(() => setActiveAlert(null), 5000);
            return () => {
                clearTimeout(alertTimer);
                clearTimeout(clearTimer);
            };
        }
    }, [state.logs]);

    return (
        <AnimatePresence>
            {activeAlert && (
                <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    className="absolute top-4 right-4 z-40"
                    key={activeAlert.id}
                >
                    <div className="bg-amber-400/10 border border-amber-400/40 backdrop-blur-xl p-4 rounded-sm shadow-[0_0_40px_rgba(251,191,36,0.2)] flex items-center gap-4 min-w-[280px]">
                        <div className="w-12 h-12 rounded-full bg-amber-400 flex items-center justify-center text-black shrink-0 shadow-[0_0_20px_rgba(251,191,36,0.5)]">
                            <Zap size={20} fill="currentColor" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-400 mb-1">HYPE GIFT RECEIVED</span>
                            <span className="text-sm font-black text-white uppercase tracking-tight">{activeAlert.user} sent {activeAlert.text}</span>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/* ─── HYPE VAULT (Earnings History) ─── */
function HypeVault() {
    const { state, dispatch } = useRadio();
    const isOpen = state.wallet.isVaultOpen;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => dispatch({ type: 'TOGGLE_VAULT', open: false })}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 right-0 bottom-0 w-96 bg-[#050505] border-l border-white/5 z-[110] shadow-[-10px_0_40px_rgba(0,0,0,0.5)] flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-8 border-b border-white/5 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black italic tracking-tighter text-white uppercase">Hype Vault</h2>
                                <p className="text-[10px] font-bold text-white/35 uppercase tracking-[0.3em]">Financial Node v4.0</p>
                            </div>
                            <button
                                onClick={() => dispatch({ type: 'TOGGLE_VAULT', open: false })}
                                className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 transition-all font-black text-xs"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Balance Overview */}
                        <div className="p-8 grid grid-cols-2 gap-4">
                            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-sm">
                                <span className="text-[8px] font-black text-white/35 uppercase tracking-widest block mb-2">Total Balance</span>
                                <div className="flex flex-col items-start leading-none gap-1">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-black text-white">{state.wallet.total}</span>
                                        <span className="text-xs font-bold text-amber-400/60 tracking-widest uppercase">HP</span>
                                    </div>
                                    <div className="text-sm font-mono font-bold text-white/30 tracking-tight">
                                        ${(state.wallet.total / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                                    </div>
                                </div>
                            </div>
                            <div className="bg-accent/5 border border-accent/10 p-4 rounded-sm">
                                <span className="text-[8px] font-black text-accent/50 uppercase tracking-widest block mb-2">Session Hype</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-accent">{state.wallet.session}</span>
                                    <span className="text-[10px] font-bold text-accent uppercase">HP</span>
                                </div>
                            </div>
                        </div>

                        {/* History */}
                        <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
                            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] block mb-6">Transaction History</span>
                            <div className="flex flex-col gap-4">
                                {state.wallet.history.map((entry: WalletEntry) => (
                                    <motion.div
                                        key={entry.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-center gap-4 group"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:bg-amber-400 group-hover:text-black transition-all">
                                            <Zap size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-xs font-black text-white truncate uppercase">{entry.user}</span>
                                                <div className="flex flex-col items-end shrink-0 gap-0.5">
                                                    <span className="text-xs font-black text-amber-400">+{entry.amount} HP</span>
                                                    <span className="text-[9px] font-mono font-medium text-white/40">
                                                        ${(entry.amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center text-[8px] font-bold uppercase tracking-widest text-white/30">
                                                <span>{entry.item}</span>
                                                <span>{new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-8 border-t border-white/5 bg-black/20">
                            <button className="w-full py-4 bg-white/5 border border-white/10 text-white/30 text-[10px] font-black uppercase tracking-[0.5em] rounded-sm hover:bg-white/10 hover:text-white transition-all">
                                Request Payout
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

/* ═══════════════════════════════════════════════════════════════
   STUDIO PANES
   ═══════════════════════════════════════════════════════════════ */

function SidebarPane({ onOpenLinker }: { onOpenLinker: () => void }) {
    const { state, dispatch } = useRadio();
    const { initAudio, togglePlay } = useAudioEngine();

    const activeTrack = state.schedule.current;
    const playlists = state.playlists || [];
    const library = state.library || [];

    // Local state for seamless drag-and-drop
    const [localQueue, setLocalQueue] = useState<Track[]>(state.schedule.queue || []);

    // Sync local queue when global state changes (e.g. track added from library)
    useEffect(() => {
        setLocalQueue(state.schedule.queue);
    }, [state.schedule.queue]);

    const handleReorder = (newQueue: Track[]) => {
        setLocalQueue(newQueue);
        // Dispatch to global state for persistence
        dispatch({ type: 'REORDER_QUEUE', queue: newQueue });
    };

    const handleLocalFolderIngest = useCallback(async () => {
        try {
            // @ts-expect-error File System Access API
            const dirHandle = await window.showDirectoryPicker();
            const tracks: Track[] = [];

            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file' && (entry.name.endsWith('.mp3') || entry.name.endsWith('.wav'))) {
                    tracks.push({
                        id: Math.random().toString(36).substr(2, 9),
                        title: entry.name.replace(/\.(mp3|wav)$/, ''),
                        artist: 'Local Ingest',
                        bpm: 120,
                        url: URL.createObjectURL(await entry.getFile())
                    });
                }
            }

            if (tracks.length > 0) {
                dispatch({ type: 'ADD_TO_LIBRARY', tracks });
                dispatch({ type: 'ADD_LOG', text: `Ingested ${tracks.length} local files from folder.` });
            }
        } catch (err) {
            console.error('Folder ingest failed:', err);
        }
    }, [dispatch]);

    useEffect(() => {
        const handler = () => {
            handleLocalFolderIngest();
        };
        window.addEventListener('trigger-folder-ingest', handler);
        return () => window.removeEventListener('trigger-folder-ingest', handler);
    }, [handleLocalFolderIngest]);

    const handleLocalFileIngest = useCallback(async () => {
        try {
            // @ts-expect-error File System Access API
            const fileHandles = await window.showOpenFilePicker({
                multiple: true,
                types: [{
                    description: 'Audio Files',
                    accept: { 'audio/*': ['.mp3', '.wav'] }
                }]
            });
            const tracks: Track[] = [];
            for (const handle of fileHandles) {
                const file = await handle.getFile();
                tracks.push({
                    id: Math.random().toString(36).substr(2, 9),
                    title: file.name.replace(/\.(mp3|wav)$/, ''),
                    artist: 'Local Ingest',
                    bpm: 120,
                    url: URL.createObjectURL(file)
                });
            }
            if (tracks.length > 0) {
                dispatch({ type: 'ADD_TO_LIBRARY', tracks });
                dispatch({ type: 'ADD_LOG', text: `Ingested ${tracks.length} local files.` });
            }
        } catch (err) {
            console.error('File ingest failed:', err);
        }
    }, [dispatch]);

    return (
        <aside className="w-80 border-r border-white/5 flex flex-col h-full bg-[#0a0a0a]">
            {/* Header */}
            <div className="p-8 border-b border-white/5 bg-white/[0.01]">
                <h2 className="text-[10px] font-black tracking-[0.4em] uppercase text-accent mb-1 px-1">Source Deck</h2>
                <div className="flex justify-between items-center mt-4 px-1">
                    <p className="text-[8px] font-bold text-white/35 uppercase tracking-widest">Library & Playlists</p>
                    <div className="flex gap-2">
                        <button
                            onClick={handleLocalFileIngest}
                            className="text-[8px] font-black uppercase tracking-widest text-white/55 hover:text-accent transition-colors border border-white/10 px-2 py-1 rounded-sm bg-white/5"
                            title="Ingest Individual Files"
                        >
                            [+ FILE]
                        </button>
                        <button
                            onClick={onOpenLinker}
                            className="text-[8px] font-black uppercase tracking-widest text-white/55 hover:text-accent transition-colors border border-white/10 px-2 py-1 rounded-sm bg-white/5"
                            title="Connect Streaming Source"
                        >
                            [+ LIST]
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col pt-6">
                {/* ON AIR */}
                <div className="px-6 mb-8">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25 mb-4 px-2">On Air</h3>
                    <div className="p-4 bg-white/[0.03] border border-white/5 rounded-lg group hover:border-accent/30 transition-all">
                        {activeTrack ? (
                            <div className="space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col gap-0.5 max-w-[180px]">
                                        <span className="text-[11px] font-bold text-white truncate leading-tight group-hover:text-accent transition-colors">
                                            {activeTrack.title}
                                        </span>
                                        <span className="text-[9px] font-medium text-white/40 truncate">
                                            {activeTrack.artist}
                                        </span>
                                    </div>
                                    <div className="text-[9px] font-mono font-bold text-accent px-1.5 py-0.5 bg-accent/10 rounded-sm">
                                        {activeTrack.bpm}
                                    </div>
                                </div>
                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: '0%' }}
                                        animate={{ width: `${(1 - state.schedule.remaining / 180) * 100}%` }}
                                        className="h-full bg-accent"
                                    />
                                </div>
                            </div>
                        ) : (
                            <span className="text-[10px] text-white/20 italic">No signal detected...</span>
                        )}
                    </div>
                </div>

                {/* UP NEXT / DRAGGABLE QUEUE */}
                <div className="px-6 mb-10">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25 mb-4 px-2">Upcoming Queue</h3>

                    <Reorder.Group
                        axis="y"
                        values={localQueue}
                        onReorder={handleReorder}
                        className="space-y-2"
                    >
                        {localQueue.map((track) => (
                            <Reorder.Item
                                key={track.instanceId || track.id}
                                value={track}
                                dragListener={true}
                                layout
                                className="flex items-center gap-4 px-4 py-3 bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] rounded-md group cursor-grab active:cursor-grabbing select-none mb-2 transition-[background-color,border-color] duration-200"
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-accent/20 group-hover:bg-accent shrink-0" />
                                <div className="flex flex-col gap-0.5 flex-1 min-w-0 pointer-events-none">
                                    <span className="text-[10px] font-bold text-white/80 truncate group-hover:text-white transition-colors">{track.title}</span>
                                    <span className="text-[8px] font-medium text-white/35 truncate uppercase tracking-tighter">{track.artist}</span>
                                </div>
                                <span className="text-[8px] font-mono text-white/20 group-hover:text-accent/80 transition-colors pointer-events-none">{track.bpm}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        dispatch({ type: 'REMOVE_FROM_QUEUE', instanceId: track.instanceId || '' });
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-2 text-white/20 hover:text-red-400 transition-all"
                                    title="Remove from queue"
                                >
                                    ✕
                                </button>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>

                    {localQueue.length === 0 && (
                        <div className="px-4 py-8 border border-dashed border-white/10 rounded-md flex flex-col items-center justify-center gap-2 bg-white/[0.01]">
                            <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/15">Playlist Queue Depleted</span>
                        </div>
                    )}
                </div>

                {/* TRACKLIST (LIBRARY) */}
                <div className="px-6 mb-10 overflow-hidden">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25 mb-4 px-2">Project Tracklist</h3>
                    <div className="space-y-1">
                        {library.map((track) => (
                            <div
                                key={track.id}
                                className="flex items-center gap-3 px-3 py-2 bg-white/[0.01] hover:bg-white/[0.03] rounded-sm transition-all group cursor-pointer"
                                onClick={() => {
                                    // Quick add to queue for now
                                    dispatch({ type: 'ADD_TO_PLAYLIST', playlistId: state.activePlaylistId, track });
                                }}
                            >
                                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                    <span className="text-[9px] font-bold text-white/60 truncate group-hover:text-white transition-colors">{track.title}</span>
                                    <span className="text-[7px] font-medium text-white/20 uppercase tracking-tighter">{track.artist}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[7px] font-mono text-white/10">{track.bpm}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`Delete "${track.title}" from library?`)) {
                                                dispatch({ type: 'REMOVE_FROM_LIBRARY', trackId: track.id });
                                            }
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-white/10 hover:text-red-400 transition-colors"
                                        title="Delete from library"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* PLAYLISTS */}
                <div className="px-6 mt-auto pb-10 border-t border-white/5 pt-8">
                    <div className="flex items-center justify-between mb-6 px-2">
                        <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25">Playlists</h3>
                        <button
                            onClick={() => {
                                const name = prompt('Playlist name:');
                                if (name && name.trim()) {
                                    dispatch({ type: 'CREATE_PLAYLIST', name: name.trim() });
                                    dispatch({ type: 'ADD_LOG', text: `Created playlist: ${name.trim()}` });
                                }
                            }}
                            className="text-[8px] font-black uppercase tracking-[0.2em] text-accent hover:text-white transition-colors px-2 py-1 rounded border border-accent/20 hover:border-accent/50 bg-accent/5"
                        >
                            + New
                        </button>
                    </div>

                    {playlists.length === 0 ? (
                        <div className="px-4 py-10 border border-dashed border-white/10 rounded-md flex flex-col items-center justify-center gap-3 bg-white/[0.01]">
                            <span className="text-[20px]">🎵</span>
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/25 text-center">No playlists yet</span>
                            <button
                                onClick={() => {
                                    const name = prompt('Name your first playlist:');
                                    if (name && name.trim()) {
                                        dispatch({ type: 'CREATE_PLAYLIST', name: name.trim() });
                                        dispatch({ type: 'ADD_LOG', text: `Created playlist: ${name.trim()}` });
                                    }
                                }}
                                className="text-[9px] font-black uppercase tracking-[0.15em] text-black bg-accent px-4 py-2 rounded-sm hover:bg-accent/90 transition-colors"
                            >
                                Create Playlist
                            </button>
                            <button
                                onClick={() => onOpenLinker()}
                                className="text-[8px] font-bold uppercase tracking-[0.15em] text-accent/60 hover:text-accent transition-colors"
                            >
                                Or import from Spotify
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-1.5 pr-2">
                            {playlists.map(playlist => {
                                const isActive = playlist.id === state.activePlaylistId;
                                return (
                                    <button
                                        key={playlist.id}
                                        onClick={() => {
                                            initAudio();
                                            dispatch({ type: 'SWITCH_PLAYLIST', playlistId: playlist.id });
                                            if (state.status !== 'PLAYING') setTimeout(() => togglePlay(), 50);
                                        }}
                                        className={cn(
                                            "w-full text-left py-3 px-4 rounded-md transition-all group border flex items-center justify-between",
                                            isActive
                                                ? "bg-accent/5 border-accent/20"
                                                : "bg-transparent border-transparent hover:bg-white/[0.02]"
                                        )}
                                    >
                                        <span className={cn(
                                            "text-[10px] font-bold tracking-tight truncate",
                                            isActive ? "text-accent" : "text-white/40 group-hover:text-white/70"
                                        )}>
                                            {playlist.name}
                                        </span>
                                        {isActive ? (
                                            <div className="w-1 h-1 rounded-full bg-accent animate-pulse" />
                                        ) : (
                                            <span className="text-[8px] font-mono text-white/10 group-hover:text-white/20 uppercase">{playlist.tracks.length} TRKS</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}

function MonitorPane() {
    const { state, dispatch } = useRadio();
    const { togglePlay } = useAudioEngine();
    const isPlaying = state.status === 'PLAYING';
    const frame = useAudioReal();

    const handleCountdownComplete = useCallback(() => {
        dispatch({ type: 'SET_BROADCAST_STATUS', status: 'LIVE' });
        if (!isPlaying) togglePlay();
    }, [dispatch, isPlaying, togglePlay]);

    const peak = frame.amplitude.length > 0 ? Math.max(...frame.amplitude.slice(0, 10)) : 0;

    return (
        <main className="flex-1 flex flex-col p-8 gap-8 relative overflow-hidden">
            {/* Architectural Grid Background */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

            <div className="flex-1 relative">
                <div className="absolute top-4 left-4 z-10 flex gap-4">
                    <div className={cn(
                        "px-3 py-1 rounded-sm border text-[10px] font-black tracking-widest uppercase transition-all duration-500",
                        isPlaying ? "border-accent text-accent bg-accent/5 shadow-[0_0_20px_rgba(255,45,85,0.2)]" : "border-white/10 text-white/20"
                    )}>
                        LIVE
                    </div>
                </div>

                <div className="absolute top-4 right-4 z-10 text-right">
                    <span className="text-[8px] font-black tracking-widest text-white/35 uppercase block mb-1">Master Node</span>
                    <span className="text-[10px] font-mono font-bold text-white/85">UK_W2_XTC</span>
                </div>

                <SpectralVisualizer isPlaying={isPlaying} />
                <InteractionFeed />
                <HypeAlert />

                {/* Main Signal Identification */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={state.nowPlaying}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex flex-col items-center"
                        >
                            <span className="text-[10px] font-black uppercase tracking-[1em] text-white/35 mb-6">Current Signal</span>
                            <h1 className="text-7xl font-black tracking-tighter text-white uppercase leading-none max-w-2xl px-12">
                                {state.nowPlaying || "Ingest required"}
                            </h1>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Countdown Overlay */}
                {state.broadcastStatus === 'COUNTDOWN' && (
                    <GoLiveCountdown onComplete={handleCountdownComplete} />
                )}
            </div>

            {/* Bottom Interaction HUD */}
            <div className="flex justify-between items-end z-10 px-4">
                <div className="flex gap-12">
                    <div className="flex flex-col gap-2">
                        <span className="text-[8px] font-black text-white/35 uppercase tracking-widest">Latency</span>
                        <span className="text-xs font-mono font-bold text-accent/80">0.02ms</span>
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="text-[8px] font-black text-white/35 uppercase tracking-widest">Active Listeners</span>
                        <span className="text-xs font-mono font-bold text-white/85">1,402</span>
                    </div>
                    <motion.div
                        key={state.wallet.session}
                        animate={{ scale: [1, 1.1, 1], color: ['rgba(255,255,255,0.85)', 'rgba(251,191,36,1)', 'rgba(255,255,255,0.85)'] }}
                        className="flex flex-col gap-2"
                    >
                        <span className="text-[8px] font-black text-amber-400/60 uppercase tracking-widest">Session Revenue</span>
                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-baseline gap-1">
                                <span className="text-xs font-mono font-bold">{state.wallet.session}</span>
                                <span className="text-[8px] font-black text-amber-400 uppercase tracking-tighter">HP</span>
                            </div>
                            <span className="text-[8px] font-mono font-bold text-white/40">
                                ${(state.wallet.session / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </motion.div>
                </div>

                <div className="flex flex-col gap-4 w-64">
                    <div className="flex justify-between items-baseline">
                        <span className="text-[8px] font-black text-white/35 uppercase tracking-widest">Master Out L/R</span>
                        <span className="text-xs font-mono font-bold text-accent">
                            {(peak * 10 * -1).toFixed(1)} dB
                        </span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-accent"
                            animate={{ width: `${peak * 100}%` }}
                            transition={{ duration: 0.05 }}
                        />
                    </div>
                </div>
            </div>
        </main>
    );
}

function ControlPane() {
    const { state, dispatch } = useRadio();
    const { triggerFX, toggleMic } = useAudioEngine();

    const handleFXTrigger = (label: string) => {
        triggerFX(label);
        dispatch({ type: 'ADD_LOG', text: `SFX: ${label} ` });
    };
    const resetParam = (id: string) => {
        if (id === 'bpm') dispatch({ type: 'UPDATE_PARAMS', payload: { bpm: 120 } });
        else dispatch({ type: 'UPDATE_PARAMS', payload: { [id]: 1.0 } });
    };

    return (
        <aside className="w-80 border-l border-white/5 flex flex-col h-full bg-[#0a0a0a]">
            <div className="p-8 border-b border-white/5 mb-4 flex justify-between items-start">
                <div>
                    <h2 className="text-[10px] font-black tracking-[0.4em] uppercase text-white/55 mb-1">Master Console</h2>
                    <p className="text-[8px] font-bold text-accent/60 uppercase">Hardware 4.0</p>
                </div>
                <button
                    onClick={() => {
                        resetParam('bpm');
                        resetParam('brightness');
                        resetParam('density');
                        dispatch({ type: 'ADD_LOG', text: 'Hardware Normalized: Defaults Restored' });
                    }}
                    className="text-[8px] font-black uppercase tracking-widest text-white/30 hover:text-accent border border-white/5 px-2 py-1 rounded-sm bg-white/[0.02] transition-all"
                >
                    [RESET ALL]
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 flex flex-col">
                <div className="flex flex-col gap-6 border-b border-white/5 pb-10">
                    <SignalLevel label="Ingest Gain" type="mono" />
                    <div className="grid grid-cols-2 gap-4">
                        <StudioFader id="bpm" label="Tempo" value={(state.bpm - 60) / 120} onDoubleClick={() => resetParam('bpm')} />
                        <StudioFader id="brightness" label="EQ" value={state.brightness} onDoubleClick={() => resetParam('brightness')} />
                        <StudioFader id="density" label="Depth" value={state.density} onDoubleClick={() => resetParam('density')} className="col-span-2" />
                        <div className="col-span-2 flex flex-col gap-2 mt-2 p-3 bg-white/[0.02] border border-white/5 rounded-sm">
                            <div className="flex justify-between text-[8px] font-bold text-amber-400/60 uppercase tracking-widest">
                                <span>Crossfade</span>
                                <span>{state.crossfadeLength.toFixed(1)}s</span>
                            </div>
                            <input
                                type="range" min="0.1" max="5" step="0.1"
                                value={state.crossfadeLength}
                                onChange={(e) => dispatch({ type: 'SET_CROSSFADE_LENGTH', length: Number(e.target.value) })}
                                className="w-full accent-amber-400 bg-white/5 h-1 rounded-full appearance-none"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-10 space-y-6">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-white/35">Integrated FX Pads</h3>
                    <div className="grid grid-cols-2 gap-2.5">
                        {['AIRHORN', 'REWIND', 'DROP', 'HYPE'].map(fx => (
                            <button
                                key={fx}
                                onClick={() => handleFXTrigger(fx)}
                                className="h-16 bg-white/[0.02] border border-white/5 rounded-sm text-[10px] font-black uppercase tracking-[0.2em] text-white/55 hover:text-accent hover:border-accent/40 hover:bg-accent/5 transition-all active:translate-y-[1px]"
                            >
                                {fx}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-12 space-y-6">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-white/35">Broadcaster Mic</h3>
                    <div className="flex flex-col gap-6 p-6 bg-white/[0.02] border border-white/5 rounded-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/70">MIC Status</span>
                            <button
                                onClick={toggleMic}
                                className={cn(
                                    "px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
                                    state.micActive ? "bg-accent text-white shadow-[0_0_20px_rgba(255,45,85,0.4)]" : "bg-white/5 text-white/35 border border-white/10"
                                )}
                            >
                                {state.micActive ? 'LIVE' : 'OFFLINE'}
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-[8px] font-bold text-white/35 uppercase tracking-widest">
                                    <span>Gain</span>
                                    <span>{Math.round(state.micGain * 100)}%</span>
                                </div>
                                <input
                                    type="range" min="0" max="2" step="0.01"
                                    value={state.micGain}
                                    onChange={(e) => dispatch({ type: 'SET_MIC_GAIN', gain: Number(e.target.value) })}
                                    className="w-full accent-accent bg-white/5 h-1 rounded-full appearance-none"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-[8px] font-bold text-white/35 uppercase tracking-widest">
                                    <span>Ducking</span>
                                    <span>{Math.round(state.duckingIntensity * 100)}%</span>
                                </div>
                                <input
                                    type="range" min="0" max="1" step="0.01"
                                    value={state.duckingIntensity}
                                    onChange={(e) => dispatch({ type: 'SET_DUCKING', intensity: Number(e.target.value) })}
                                    className="w-full accent-accent bg-white/5 h-1 rounded-full appearance-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-12 space-y-4">
                    <SignalLevel label="Master Out L" type="left" />
                    <SignalLevel label="Master Out R" type="right" />
                </div>

                <button className="w-full mt-auto py-5 border border-white/5 bg-transparent rounded-sm text-[9px] font-black uppercase tracking-[0.4em] text-white/55 hover:text-accent hover:border-accent/40 transition-all">
                    Release Control
                </button>
            </div>
        </aside>
    );
}

function TransportBar() {
    const { state, dispatch } = useRadio();
    const { initAudio, togglePlay, skipNext, skipPrevious } = useAudioEngine();
    const isPlaying = state.status === 'PLAYING';
    const isLive = state.broadcastStatus === 'LIVE';

    const handleTransportClick = () => {
        initAudio(); // Initialize on user gesture to avoid browser blocks
        if (state.broadcastStatus === 'STANDBY') {
            dispatch({ type: 'SET_BROADCAST_STATUS', status: 'COUNTDOWN' });
        } else {
            togglePlay();
        }
    };

    return (
        <footer className="h-32 border-t border-white/5 bg-[#0a0a0a] flex items-center px-12 gap-16">
            <div className="w-80 flex items-center gap-6">
                <div className={cn(
                    "w-16 h-16 rounded-sm border flex items-center justify-center text-xl font-black transition-all",
                    isLive ? "border-accent/40 text-accent bg-accent/5" : "border-white/5 text-white/35"
                )}>
                    {state.nowPlaying?.charAt(0) || 'Ø'}
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/85 mb-1">XTC Engine v4</p>
                    <p className="text-sm font-bold text-white truncate uppercase tracking-tight">Main Signal Out</p>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center gap-16">
                <button
                    onClick={skipPrevious}
                    className="text-white/55 hover:text-white transition-colors active:scale-90"
                >
                    <SkipBack size={32} />
                </button>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleTransportClick}
                    className={cn(
                        "w-20 h-20 rounded-full border flex items-center justify-center transition-all shadow-2xl relative",
                        isLive ? "border-accent text-accent bg-accent/10" : "border-white/10 text-white"
                    )}
                >
                    {state.broadcastStatus === 'COUNTDOWN' && (
                        <motion.div
                            layoutId="ring"
                            className="absolute -inset-2 border-2 border-accent rounded-full"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1.2, opacity: [0, 1, 0] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                        />
                    )}
                    {isPlaying ? <Pause size={36} /> : <Play size={36} className="ml-1.5" />}
                </motion.button>
                <button
                    onClick={skipNext}
                    className="text-white/55 hover:text-white transition-colors active:scale-90"
                >
                    <SkipForward size={32} />
                </button>
            </div>

            <div className="w-80 flex justify-end gap-10 items-center">
                <button className="group flex flex-col items-center gap-2">
                    <Headphones size={20} className="text-white/55 group-hover:text-white transition-colors" />
                    <span className="text-[8px] font-black uppercase text-white/35 tracking-[0.2em]">Monitoring</span>
                </button>
                <button className="group flex flex-col items-center gap-2">
                    <Sliders size={20} className="text-white/55 group-hover:text-white transition-colors" />
                    <span className="text-[8px] font-black uppercase text-white/35 tracking-[0.2em]">Setup</span>
                </button>
                <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-white/55 hover:text-white transition-all">
                    <Bell size={18} />
                </div>
            </div>
        </footer>
    );
}

/* ═══════════════════════════════════════════════════════════════
   FULL BROADCASTER STUDIO
   ═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   STUDIO LAYOUT (Internal Component for Context Access)
   ═══════════════════════════════════════════════════════════════ */
function StudioLayout() {
    const { state, dispatch } = useRadio();
    const [isLinkerOpen, setIsLinkerOpen] = useState(false);
    const codeExchangedRef = useRef(false);

    // Spotify OAuth Handshake Completion
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code && !codeExchangedRef.current) {
            codeExchangedRef.current = true;

            // Clean the URL immediately to prevent re-runs
            window.history.replaceState({}, document.title, window.location.pathname);

            const completeAuth = async () => {
                dispatch({ type: 'ADD_LOG', text: 'Spotify Handshake: Exchanging code...' });
                try {
                    const { token } = await SpotifyService.exchangeCode(code);

                    // Store the token so the SourceLinkerModal can use it
                    localStorage.setItem('spotify_access_token', token);

                    dispatch({ type: 'ADD_LOG', text: `✅ Spotify Connected! Open Music Source to browse your library.` });

                    // Auto-open the linker so user can pick playlists
                    setIsLinkerOpen(true);
                } catch (err) {
                    console.error('Spotify Auth Error:', err);
                    dispatch({ type: 'ADD_LOG', text: 'Spotify Link Failed. Try connecting again.', level: 'error' });
                }
            };
            completeAuth();
        }
    }, [dispatch]);

    // Mock Audience Interaction Engine
    useEffect(() => {
        if (state.status !== 'PLAYING') return;

        const interval = setInterval(() => {
            const chance = Math.random();
            if (chance < 0.3) { // 30% chance for interaction
                const types: LogType[] = ['FAN_REACTION', 'FAN_COMMENT', 'FAN_GIFT'];
                const type = types[Math.floor(Math.random() * types.length)];

                const mockUsers = ['CyberPunk', 'AudioHead', 'XTC_Fan', 'RaveMaster', 'LofiGirl', 'BassJunkie'];
                const user = mockUsers[Math.floor(Math.random() * mockUsers.length)];

                const texts: Record<string, string[]> = {
                    FAN_REACTION: ['❤️ x 5', '🔥 x 3', '🙌🙌🙌', '⚡️⚡️⚡️', '✨✨✨'],
                    FAN_COMMENT: ['This drop is insane!', 'Best set I\'ve heard all week.', 'Who is this artist?', 'Vibe check: 10/10', 'Turning this UP!'],
                    FAN_GIFT: ['Digital Vinyl', 'Neon Headphones', 'Gold Mic', 'Super Bass Boost'],
                    SYSTEM: ['Signal Optimized', 'Bitrate Stable']
                };

                dispatch({
                    type: 'ADD_LOG',
                    text: texts[type][Math.floor(Math.random() * texts[type].length)],
                    logType: type,
                    user
                });

                if (type === 'FAN_GIFT') {
                    const items = ['Digital Vinyl', 'Neon Headphones', 'Gold Mic', 'Super Bass Boost'];
                    const amounts = [50, 25, 100, 75];
                    const idx = Math.floor(Math.random() * items.length);
                    dispatch({
                        type: 'DEPOSIT_HYPE',
                        amount: amounts[idx],
                        user,
                        item: items[idx]
                    });
                }
            }
        }, 8000);

        return () => clearInterval(interval);
    }, [state.status, dispatch]);

    return (
        <div className="h-screen bg-black text-white flex flex-col overflow-hidden selection:bg-accent/40 font-sans">
            <Header />

            <div className="flex flex-1 overflow-hidden">
                <SidebarPane onOpenLinker={() => setIsLinkerOpen(true)} />
                <MonitorPane />
                <ControlPane />
            </div>

            <TransportBar />

            {/* Modals & Panels */}
            <HypeVault />
            <SourceLinkerModal isOpen={isLinkerOpen} onClose={() => setIsLinkerOpen(false)} />
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   FULL BROADCASTER STUDIO EXPORT
   ═══════════════════════════════════════════════════════════════ */
export function StreamerApp() {
    return (
        <RadioProvider>
            <StudioLayout />
        </RadioProvider>
    );
}
