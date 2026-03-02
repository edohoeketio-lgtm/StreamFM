import { useState, useEffect, useRef } from 'react';
import { useRadio } from '../hooks/useRadio';

export interface AudioFrame {
    amplitude: number[]; // Array of 0-1 values for frequency bars
    waveform: number[];  // Array of -1 to 1 values for waveform
}

export function useAudioSimulation() {
    const { state } = useRadio();
    const [frame, setFrame] = useState<AudioFrame>({ amplitude: [], waveform: [] });
    const requestRef = useRef<number | null>(null);

    // Simulation parameters driven by state
    const { status, bpm, density, brightness, seed } = state;

    const lastAmplitude = useRef<number[]>(new Array(32).fill(0));

    useEffect(() => {
        const animate = (time: number) => {
            if (status !== 'PLAYING') {
                const idleAmp = Array.from({ length: 32 }, (_, i) => Math.sin(time * 0.002 + i * 0.2) * 0.1 + 0.1);
                const idleWave = Array.from({ length: 100 }, (_, i) => Math.sin(time * 0.005 + i * 0.1) * 0.05);
                setFrame({ amplitude: idleAmp, waveform: idleWave });
                requestRef.current = requestAnimationFrame(animate);
                return;
            }

            const beatInterval = 60000 / bpm;
            const beatProgress = (time % beatInterval) / beatInterval;
            const onBeat = beatProgress < 0.15;

            const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

            const currentAmplitude = lastAmplitude.current.map((prev, i) => {
                const noise = Math.sin(time * 0.005 + i) * 0.2 + 0.2;
                let target = (Math.random() * 0.3 + noise) * density;
                if (i < 5 && onBeat) target += 0.6;
                if (i > 20) target += (Math.random() * 0.2) * brightness;
                return lerp(prev, Math.min(1, target), 0.15);
            });

            lastAmplitude.current = currentAmplitude;

            const waveform = Array.from({ length: 100 }, (_, i) => {
                const phase = time * 0.005 * (bpm / 120);
                const w1 = Math.sin(phase + i * 0.1);
                const w2 = Math.sin(phase * 0.5 + i * 0.05) * 0.5;
                const w3 = Math.sin(phase * 2 + i * 0.2) * 0.2;
                const noise = (Math.random() - 0.5) * density * 0.1;
                return (w1 + w2 + w3) * 0.4 + noise;
            });

            setFrame({ amplitude: currentAmplitude, waveform });
            requestRef.current = requestAnimationFrame(animate);
        };

        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [status, bpm, density, brightness, seed]);

    return frame;
}
