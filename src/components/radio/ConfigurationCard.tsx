import { useState } from 'react';
import { useRadio, useAudioEngine } from '../../hooks/useRadio';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ArrowRight } from '../ui/Icons';
import { motion, AnimatePresence } from 'framer-motion';
import { Track } from '../../types/radio';

/* ─── Streamer: Queue Manager ─── */
function QueueManager() {
    const { state, dispatch } = useRadio();
    const { initAudio, togglePlay } = useAudioEngine();
    const activePlaylist = state.playlists.find((p: { id: string }) => p.id === state.activePlaylistId);

    const [showSourceModal, setShowSourceModal] = useState(false);

    const handleGoLive = async () => {
        initAudio();
        dispatch({ type: 'SWITCH_STATION', stationId: state.activePlaylistId });
        dispatch({ type: 'ADD_LOG', text: `Broadcasting: ${activePlaylist?.name}. Queue loaded.` });

        if (state.status !== 'PLAYING') {
            setTimeout(() => togglePlay(), 50);
        }
    };

    const removeFromQueue = (index: number) => {
        const newQueue = state.schedule.queue.filter((_: Track, i: number) => i !== index);
        dispatch({ type: 'REORDER_QUEUE', queue: newQueue });
    };

    return (
        <>
            <div className="space-y-2 flex-1">
                <label className="text-[10px] uppercase font-bold text-secondary tracking-widest flex items-center gap-2">
                    Live Queue
                </label>
                <div className="flex flex-col gap-1.5 mt-2 overflow-y-auto max-h-[240px] pr-1 -mr-1 custom-scrollbar">
                    {state.schedule.queue.map((track: Track, i: number) => (
                        <div
                            key={track.instanceId || `${track.id}-${i}`}
                            className="flex items-center justify-between p-2.5 rounded-lg border border-card-border/50 hover:border-primary/20 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] font-mono text-secondary/40 tabular-nums w-4">{String(i + 1).padStart(2, '0')}</span>
                                <span className="text-xs font-medium text-primary">{track.title} - {track.artist}</span>
                            </div>
                            <button
                                onClick={() => removeFromQueue(i)}
                                className="text-secondary/30 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 text-xs"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
                <button
                    onClick={() => setShowSourceModal(!showSourceModal)}
                    className="w-full mt-2 p-3 rounded-lg border border-dashed border-card-border hover:border-primary/30 transition-colors text-xs text-secondary hover:text-primary uppercase tracking-widest font-bold"
                >
                    + Add Source
                </button>
            </div>

            {/* Source Modal */}
            <AnimatePresence>
                {showSourceModal && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="grid grid-cols-2 gap-2 mt-3">
                            {['Spotify', 'Apple Music', 'YouTube Music', 'Local Files'].map(source => (
                                <button
                                    key={source}
                                    className="p-2.5 rounded-lg hardware-button text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/5 transition-colors"
                                    onClick={() => {
                                        dispatch({ type: 'ADD_LOG', text: `Source: ${source} (connect flow coming soon)` });
                                        setShowSourceModal(false);
                                    }}
                                >
                                    {source}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Button
                onClick={handleGoLive}
                className={`w-full mt-auto h-12 hardware-button group font-medium tracking-wide ${state.status === 'PLAYING'
                    ? 'text-white border-accent bg-accent'
                    : 'text-primary'
                    }`}
            >
                <span className="mr-2">{state.status === 'PLAYING' ? '● ON AIR' : 'GO LIVE'}</span>
                {state.status !== 'PLAYING' && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 opacity-50" />}
            </Button>
        </>
    );
}

/* ─── Listener: Frequency Dial ─── */
function FrequencyDial() {
    const { state, dispatch } = useRadio();
    const { initAudio, togglePlay } = useAudioEngine();
    const [selectedId, setSelectedId] = useState(state.activePlaylistId);

    const handleTuneIn = async () => {
        const targetPlaylist = state.playlists.find((p: { id: string }) => p.id === selectedId);
        if (!targetPlaylist) return;

        initAudio();
        dispatch({ type: 'SWITCH_STATION', stationId: selectedId });
        dispatch({ type: 'ADD_LOG', text: `Tuned into: ${targetPlaylist.name}. Connecting stream...` });

        if (state.status !== 'PLAYING') {
            setTimeout(() => togglePlay(), 50);
        }
    };

    const isAlreadyActive = selectedId === state.activePlaylistId && state.status === 'PLAYING';

    return (
        <>
            <div className="space-y-2 flex-1">
                <label className="text-[10px] uppercase font-bold text-secondary tracking-widest flex items-center gap-2">
                    Live Frequencies
                </label>
                <div className="flex flex-col gap-2 mt-2 overflow-y-auto max-h-[280px] pr-1 -mr-1 custom-scrollbar">
                    {state.playlists.map((playlist: { id: string; name: string; description: string; tags: string[] }) => {
                        const isSelected = selectedId === playlist.id;
                        const isLive = playlist.id === state.activePlaylistId && state.status === 'PLAYING';
                        const count = state.listenerCounts[playlist.id] || 0;

                        return (
                            <button
                                key={playlist.id}
                                onClick={() => setSelectedId(playlist.id)}
                                className={`flex flex-col items-start w-full rounded-lg border px-4 py-3 text-left transition-all ${isSelected
                                    ? 'border-accent bg-accent/10 shadow-sm'
                                    : 'border-card-border hover:border-secondary/30 hover:bg-white/5'
                                    }`}
                            >
                                <div className="flex items-center gap-2 w-full">
                                    {isLive && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                                    )}
                                    <span className={`text-sm font-medium ${isSelected ? 'text-accent' : 'text-primary'}`}>
                                        {playlist.name}
                                    </span>
                                    <span className="ml-auto text-[9px] font-mono text-secondary/50 tabular-nums">
                                        {count.toLocaleString()}
                                    </span>
                                </div>
                                <span className="text-xs text-secondary truncate w-full">
                                    {playlist.description}
                                </span>
                                <div className="flex gap-1 mt-1.5">
                                    {playlist.tags.map((tag: string) => (
                                        <span
                                            key={tag}
                                            className={`text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-sm ${isSelected
                                                ? 'bg-accent/15 text-accent'
                                                : 'bg-white/5 text-secondary'
                                                }`}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <Button
                onClick={handleTuneIn}
                className={`w-full mt-auto h-12 hardware-button group font-medium tracking-wide ${isAlreadyActive
                    ? 'text-secondary opacity-60 pointer-events-none'
                    : 'text-primary'
                    }`}
            >
                <span className="mr-2">{isAlreadyActive ? 'TUNED IN' : 'TUNE IN'}</span>
                {!isAlreadyActive && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 opacity-50" />}
            </Button>
        </>
    );
}

/* ─── Main Export ─── */
export function ConfigurationCard() {
    const { state } = useRadio();

    return (
        <Card
            title={state.role === 'streamer' ? 'Queue Manager' : 'Station Selector'}
            className="col-span-12 lg:col-span-4 flex flex-col gap-4"
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={state.role}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col gap-4 flex-1"
                >
                    {state.role === 'streamer' ? <QueueManager /> : <FrequencyDial />}
                </motion.div>
            </AnimatePresence>
        </Card>
    );
}
