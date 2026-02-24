import { useEffect, useRef } from 'react';
import { useRadio, useAudioEngine } from '../../hooks/useRadio';
import { useAudioReal } from '../../hooks/useAudioReal';
import { Card } from '../ui/Card';
import { Play, Pause, Square, RefreshCcw } from '../ui/Icons';

import { motion, AnimatePresence } from 'framer-motion';

export function Visualizer() {
    const { state } = useRadio();
    const { status, bpm, nowPlaying, activeStationId, stations } = state;

    const { amplitude, waveform } = useAudioReal();

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const activeStation = stations.find(s => s.id === activeStationId);

    // Timeline Drawing Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, rect.width, rect.height);

        const w = rect.width;
        const h = rect.height;
        // Shift center up slightly to account for bottom controls/overlays
        // Visual center is roughly 40-45% down the canvas, not 50%
        const centerY = h * 0.45;

        // Draw Timeline Ticks (Top and Bottom)
        ctx.fillStyle = '#d8d8d8';
        ctx.font = '10px "SF Mono", monospace';

        // Horizontal Line
        ctx.strokeStyle = '#e5e5e5';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, centerY); // Match new center
        ctx.lineTo(w, centerY); // Match new center
        ctx.stroke();

        // Fluid Sine Waves (Siri-style Synthesized)
        // We accumulate total volume to drive the amplitude of the sine waves
        const volume = amplitude.reduce((acc, val) => acc + val, 0) / (amplitude.length || 1);
        const intensity = Math.min(1, volume * 1.5); // Boost a bit

        // Use performance.now() for smooth continuous animation
        const time = performance.now() * 0.003; // Slightly faster for fluidity

        // Settings for the 3 overlapping waves
        const waves = [
            { color: status === 'PLAYING' ? 'rgba(11, 11, 11, 1)' : 'rgba(209, 213, 219, 1)', speed: 1, freq: 0.012, amp: 1 },
            { color: status === 'PLAYING' ? 'rgba(11, 11, 11, 0.5)' : 'rgba(209, 213, 219, 0.5)', speed: 1.5, freq: 0.018, amp: 0.8 },
            { color: status === 'PLAYING' ? 'rgba(11, 11, 11, 0.2)' : 'rgba(209, 213, 219, 0.2)', speed: 0.7, freq: 0.009, amp: 0.6 },
        ];

        waves.forEach((wave) => {
            ctx.beginPath();
            ctx.strokeStyle = wave.color;
            ctx.lineWidth = 1.5; // Refined thin lines
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Draw curve point by point across the width
            for (let x = 0; x <= w; x += 3) {
                // Sine wave synthesis with organic frequency modulation
                const organicFreq = wave.freq + (Math.sin(x * 0.01 + time) * 0.002);
                const normalizedY = Math.sin(x * organicFreq + time * wave.speed);

                // Edge Taper: Force amplitude to 0 at x=0 and x=w
                // Using a sine window: sin(0) = 0, sin(PI) = 0, sin(PI/2) = 1
                const taper = Math.sin((x / w) * Math.PI);

                // If not playing, flat line. If playing, modulate by volume & tapering
                const waveHeight = status === 'PLAYING'
                    ? normalizedY * (h * 0.3) * intensity * wave.amp * Math.pow(taper, 0.5) // Sqrt taper for wider center
                    : 0;

                const y = centerY + waveHeight;

                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        });

        // Vertical Playhead
        if (status === 'PLAYING') {
            ctx.strokeStyle = '#ef4444'; // Red playhead
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(w / 2, 0);
            ctx.lineTo(w / 2, h);
            ctx.stroke();
        }

    }, [amplitude, waveform, status]);

    // Use new audio controls
    const { togglePlay, stop } = useAudioEngine();

    // Auto-Rotation is now handled by Context Scheduler, so we remove the local Timer
    // But we still render the result

    return (
        <Card className="col-span-12 lg:col-span-8 h-[320px] md:h-[400px] flex flex-col relative !p-0 bg-white shadow-sm border border-card-border overflow-hidden rounded-3xl">
            {/* Header Strip: Broadcast Status Bar */}
            <div className="px-5 py-3 flex justify-between items-center border-b border-card-border/50 bg-gray-50/80 backdrop-blur-md z-10">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-[0.2em] text-secondary font-bold opacity-60">Frequency Source</span>
                        <span className="text-xs font-bold text-primary tracking-wide">{activeStation?.name || 'OFFLINE'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Live Indicator */}
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-card-border rounded-full shadow-sm">
                        <div className={`w-1.5 h-1.5 rounded-full ${status === 'PLAYING' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                        <span className="text-[9px] font-bold text-secondary uppercase tracking-wider">
                            {state.status === 'PLAYING' ? 'LIVE' : 'OFFLINE'}
                        </span>
                    </div>

                    {/* Listener Count */}
                    <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-secondary tabular-nums opacity-80">
                        <span className="w-1 h-1 rounded-full bg-primary/20" />
                        {state.listenerCounts[activeStationId || '']?.toLocaleString() || '---'} listening
                    </div>

                    <div className="w-px h-4 bg-card-border/60 mx-1 hidden sm:block"></div>

                    <div className="px-2 py-1 bg-white border border-card-border rounded text-[10px] font-mono text-secondary tabular-nums shadow-sm">
                        {bpm} BPM
                    </div>
                </div>
            </div>

            {/* Canvas Area (Timeline) */}
            <div className="relative flex-1 bg-gray-50/20">
                <canvas ref={canvasRef} className="w-full h-full" />

                {/* Time Ticks Overlay */}
                <div className="absolute top-0 left-0 right-0 h-6 border-b border-card-border/30 flex justify-between px-4 text-[9px] font-mono text-gray-400 select-none pointer-events-none">
                    <span>00:00</span>
                    <span>00:15</span>
                    <span>00:30</span>
                    <span>00:45</span>
                    <span>01:00</span>
                </div>
            </div>

            {/* Broadcast Info Panel (Bottom Left) */}
            <div className="absolute bottom-6 left-6 max-w-[260px] flex flex-col gap-3 pointer-events-none">
                {/* Now Playing */}
                <AnimatePresence mode='wait'>
                    <motion.div
                        key={nowPlaying}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex flex-col p-3 rounded-xl bg-white/90 backdrop-blur-md border border-card-border shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
                    >
                        <span className="text-[9px] uppercase text-secondary font-bold tracking-widest mb-1 flex items-center gap-1.5">
                            <span className={`w-1 h-1 rounded-full ${status === 'PLAYING' ? 'bg-red-500' : 'bg-gray-300'}`} />
                            Current Program
                        </span>
                        <span className="text-sm font-semibold text-primary tracking-tight leading-tight line-clamp-2">
                            {nowPlaying}
                        </span>
                        <div className="mt-2 flex items-center gap-2">
                            <span className="text-[9px] font-mono border border-card-border bg-gray-50 px-1.5 py-0.5 rounded text-secondary uppercase">
                                {state.programMode}
                            </span>
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Up Next (Mini Schedule) */}
                <div className="flex flex-col p-3 rounded-xl bg-white/80 backdrop-blur-sm border border-card-border/60">
                    <span className="text-[9px] uppercase text-secondary/60 font-bold tracking-widest mb-2">Up Next</span>
                    <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-[10px]">
                            <span className="text-primary font-medium truncate max-w-[140px]">{state.schedule.next}</span>
                            <span className="text-secondary font-mono">{Math.floor(state.schedule.remaining)}s</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] opacity-60">
                            <span className="text-primary truncate max-w-[140px]">{state.schedule.later}</span>
                            <span className="text-secondary font-mono">Later</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hardware Controls (Bottom Right Dial Cluster) */}
            <div className="absolute bottom-6 right-6 flex items-center gap-4 z-20">
                {/* Secondary Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={stop}
                        className="w-10 h-10 rounded-full border border-gray-200 bg-white shadow-sm flex items-center justify-center text-secondary hover:bg-gray-50 active:translate-y-px active:shadow-inner transition-all"
                        aria-label="Stop"
                    >
                        <Square size={14} fill="currentColor" />
                    </button>
                    {/* Regenerate is less useful with scheduler, but kept for manual override */}
                    <button
                        onClick={() => { togglePlay(); /* Re-trigger play to crossfade if logic allowed */ }}
                        className="w-10 h-10 rounded-full border border-gray-200 bg-white shadow-sm flex items-center justify-center text-secondary hover:bg-gray-50 active:translate-y-px active:shadow-inner transition-all opacity-50 cursor-not-allowed"
                        aria-label="Refresh"
                        disabled
                    >
                        <RefreshCcw size={14} />
                    </button>
                </div>

                {/* Main Dial */}
                <div className="relative w-16 h-16 rounded-full bg-white border border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center justify-center group">
                    {/* Outer Ring decoration */}
                    <div className="absolute inset-0 rounded-full border border-gray-100 pointer-events-none" />

                    <button
                        onClick={togglePlay}
                        className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-md active:scale-95 transition-transform"
                    >
                        {status === 'PLAYING' ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" className="ml-0.5" />}
                    </button>
                </div>
            </div>
        </Card>
    );
}
