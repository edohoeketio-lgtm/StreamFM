import { useState, useEffect, useRef } from 'react';
import { useRadio, useAudioEngine } from '../hooks/useRadio';

export interface AudioFrame {
    amplitude: number[];
    waveform: number[];
}

export function useAudioReal() {
    const { state } = useRadio();
    const { analyser } = useAudioEngine();
    const [frame, setFrame] = useState<AudioFrame>({ amplitude: [], waveform: [] });
    const requestRef = useRef<number | null>(null);

    // Buffers
    const dataArrayRef = useRef<Uint8Array | null>(null);
    const waveArrayRef = useRef<Float32Array | null>(null);

    const animate = () => {
        // If not playing or no analyser, show idle state
        if (!analyser.current || state.status !== 'PLAYING') {
            const time = Date.now();
            // Simple idle animation (sine waves)
            const idleAmp = Array.from({ length: 128 }, (_, i) => Math.sin(time * 0.002 + i * 0.1) * 0.2 + 0.1);

            const idleWave = Array.from({ length: 100 }, (_, i) => Math.sin(time * 0.005 + i * 0.1) * 0.05);
            setFrame({ amplitude: idleAmp, waveform: idleWave });
            requestRef.current = requestAnimationFrame(animate);
            return;
        }

        const ana = analyser.current;

        // Init buffers if size changed or first run
        if (!dataArrayRef.current || dataArrayRef.current.length !== ana.frequencyBinCount) {
            dataArrayRef.current = new Uint8Array(ana.frequencyBinCount);
            waveArrayRef.current = new Float32Array(ana.frequencyBinCount);
        }

        // Get Data (casting 'any' to bypass ArrayBuffer/SharedArrayBuffer mismatch in strict mode)
        ana.getByteFrequencyData(dataArrayRef.current as any);

        if (waveArrayRef.current) {
            ana.getFloatTimeDomainData(waveArrayRef.current as any);
        }

        // Process Frequency (1:1 mapping of 128 bins for high resolution)
        const rawAmp = dataArrayRef.current;
        const bars: number[] = [];

        // Use all 128 bins (frequencyBinCount)
        for (let i = 0; i < rawAmp.length; i++) {
            // Normalize 0-255 -> 0-1
            bars.push(rawAmp[i] / 255);
        }

        // Process Waveform (downsample to 100 points)
        const rawWave = waveArrayRef.current;
        const wave: number[] = [];

        if (rawWave) {
            const step = Math.ceil(rawWave.length / 100);
            for (let i = 0; i < 100; i++) {
                wave.push(rawWave[i * step] || 0);
            }
        }

        setFrame({ amplitude: bars, waveform: wave });
        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [state.status]);

    return frame;
}
