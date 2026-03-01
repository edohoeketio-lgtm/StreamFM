import { useRadio } from '../../hooks/useRadio';
import { type ProgramMode, type Track } from '../../types/radio';
import { Card } from '../ui/Card';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Broadcast Modes (for Streamer) ─── */
const BROADCAST_MODES: { mode: ProgramMode; desc: string }[] = [
    { mode: 'Continuous Flow', desc: 'Auto-DJ the queue, seamless transitions' },
    { mode: 'Pulse / Groove', desc: 'Fast-paced energy, short segments' },
    { mode: 'Golden Hour', desc: 'Laid-back, warm and golden' },
    { mode: 'After Hours', desc: 'Extended deep dives, long mixes' },
    { mode: 'Experimental', desc: 'Anything goes — surprise your listeners' },
];

/* ─── Streamer: Broadcast Mode ─── */
function BroadcastMode() {
    const { state, dispatch } = useRadio();
    const { programMode } = state;

    const handleModeChange = (mode: ProgramMode) => {
        dispatch({ type: 'SET_PROGRAM_MODE', mode });
        dispatch({ type: 'ADD_LOG', text: `Broadcast mode: ${mode}` });
    };

    return (
        <>
            <p className="text-xs text-primary/60 mb-3">Controls how your broadcast evolves over time.</p>
            <div className="flex flex-col gap-1.5">
                {BROADCAST_MODES.map(({ mode, desc }) => {
                    const isActive = programMode === mode;
                    return (
                        <motion.button
                            key={mode}
                            onClick={() => handleModeChange(mode)}
                            whileTap={{ scale: 0.98 }}
                            className={`relative w-full text-left px-3 py-2 rounded-lg text-xs font-medium border transition-all ${isActive
                                ? 'bg-accent text-white border-accent shadow-sm'
                                : 'bg-card text-primary/80 border-card-border hover:bg-white/5'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="font-semibold">{mode}</span>
                                    <span className={`text-[9px] mt-0.5 ${isActive ? 'text-white/60' : 'text-secondary/50'}`}>{desc}</span>
                                </div>
                                {isActive && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
                                )}
                            </div>
                        </motion.button>
                    );
                })}
            </div>
        </>
    );
}

/* ─── Listener: Schedule Card ─── */
function ScheduleView() {
    const { state } = useRadio();
    const { schedule } = state;
    const activePlaylist = state.playlists.find((p: { id: string }) => p.id === state.activePlaylistId);

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    const nextTrack: Track | undefined = schedule.queue[0];
    const laterTrack: Track | undefined = schedule.queue[1];

    return (
        <>
            <p className="text-xs text-primary/60 mb-3">
                {activePlaylist ? `${activePlaylist.name} — Schedule` : 'Select a station to see the schedule'}
            </p>
            <div className="flex flex-col gap-2">
                {/* Current */}
                <div className="p-3 rounded-lg bg-accent text-white border border-accent">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-white/60">Now Playing</span>
                        <span className="text-[10px] font-mono text-white/60">{formatTime(schedule.remaining)}</span>
                    </div>
                    <span className="text-sm font-semibold">
                        {schedule.current ? `${schedule.current.title} - ${schedule.current.artist}` : 'Nothing playing'}
                    </span>
                </div>
                {/* Up Next */}
                <div className="p-3 rounded-lg border border-card-border">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-secondary/50 block mb-1">Up Next</span>
                    <span className="text-xs font-medium text-primary">
                        {nextTrack ? `${nextTrack.title} - ${nextTrack.artist}` : '—'}
                    </span>
                </div>
                {/* Later */}
                <div className="p-3 rounded-lg border border-card-border/50 opacity-60">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-secondary/50 block mb-1">Later</span>
                    <span className="text-xs font-medium text-primary/60">
                        {laterTrack ? `${laterTrack.title} - ${laterTrack.artist}` : '—'}
                    </span>
                </div>
            </div>

            <div className="p-3 bg-white/5 rounded border border-card-border mt-4">
                <p className="text-xs text-primary/60">
                    <strong className="block text-primary/80 mb-1">Currently Tuned</strong>
                    {activePlaylist?.name || 'No station selected'}
                </p>
            </div>
        </>
    );
}

/* ─── Main Export ─── */
export function ScaleModelCard() {
    const { state } = useRadio();

    return (
        <Card
            title={state.role === 'streamer' ? 'Broadcast Mode' : 'Schedule'}
            className="col-span-12 md:col-span-3"
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={state.role}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                >
                    {state.role === 'streamer' ? <BroadcastMode /> : <ScheduleView />}
                </motion.div>
            </AnimatePresence>
        </Card>
    );
}
