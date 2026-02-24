import { useReducer, useEffect, useRef, type ReactNode } from 'react';
import { RadioContext, AudioRefsContext } from './RadioContexts';
import { RadioState, RadioAction, Station } from '../types/radio';

const STATIONS: Station[] = [
    {
        id: 'feel-good-1',
        name: 'Feel-Good',
        description: 'Vibes for a good time',
        sourceType: 'local',
        sourceUrls: [
            '/audio/lofi.mp3',
            '/audio/Birds & the Bees - Baby Keem.mp3',
            '/audio/Good Flirts - Baby Keem.mp3',
            '/audio/Poor Thang - J. Cole.mp3'
        ],
        tags: ['Vibe', 'Happy', 'Soul'],
        mockSegments: ['Sunshine Day', 'Good Times Roll', 'Morning Coffee', 'Sunday Drive', 'Golden Hour']
    },
    {
        id: 'lofi-1',
        name: 'Lo-Fi Hip Hop',
        description: 'Quality hip-hop and chill beats',
        sourceType: 'local',
        sourceUrls: [
            '/audio/Perfect Enemy - Vinnie Paz.mp3',
            '/audio/Birds & the Bees - Baby Keem.mp3',
            '/audio/Good Flirts - Baby Keem.mp3',
            '/audio/Poor Thang - J. Cole.mp3'
        ],
        tags: ['Chill', 'Study', 'Beats'],
        mockSegments: ['Rainy Window', 'Homework Edit', 'Late Night Coffee', 'Vinyl Crackle loops', 'Cat on Keyboard']
    },
    {
        id: 'techno-1',
        name: 'Minimal Techno',
        description: 'Deep driving minimal techno, 128bpm',
        sourceType: 'local',
        sourceUrls: ['/audio/electronic.mp3'],
        tags: ['Techno', 'Minimal', 'Dark'],
        mockSegments: ['Warehouse Echo', 'Berlin Sub', 'Modulator X', 'Kick Drum Therapy', '3AM Vibe']
    },
    {
        id: 'jazz-1',
        name: 'Jazz Fusion',
        description: 'Upbeat Jazz Fusion with complex solos',
        sourceType: 'local',
        sourceUrls: ['/audio/sexy music..mp3'],
        tags: ['Jazz', 'Fusion', 'Funk'],
        mockSegments: ['Sax Attack', 'Bass Slap 101', 'Fusion Kitchen', 'Smooth Operator', 'Blue Note Vibe']
    },
    {
        id: 'afro-1',
        name: 'Afrobeat',
        description: 'Energetic Afrobeat rhythms',
        sourceType: 'local',
        sourceUrls: ['/audio/electronic.mp3'],
        tags: ['Afrobeat', 'Ryhthm', 'Brass'],
        mockSegments: ['Lagos Night Drive', 'Palmwine Groove', 'Talking Drum', 'Heatwave', 'Market Day']
    },
    {
        id: 'synth-1',
        name: 'Synthwave',
        description: 'Retro 80s Synthwave, neon lights',
        sourceType: 'local',
        sourceUrls: ['/audio/electronic.mp3'],
        tags: ['Retro', 'Synth', '80s'],
        mockSegments: ['Neon Arps', 'Cyber Chase', 'VHS Dreams', 'Nightcall Cover', 'Grid Runner']
    },
    {
        id: 'ambient-1',
        name: 'Ambient',
        description: 'Ethereal soundscapes',
        sourceType: 'local',
        sourceUrls: ['/audio/ambient.mp3'],
        tags: ['Ambient', 'Drone', 'Sleep'],
        mockSegments: ['Deep Space', 'Ocean Drift', 'Beta Waves', 'Cloud Computing', 'Silence & Awe']
    }
];

const initialState: RadioState = {
    status: 'IDLE',
    apiKey: '',
    prompt: 'Feel-Good',
    bpm: 120,
    density: 0.5,
    brightness: 0.5,
    mixOptions: {
        muteBass: false,
        muteDrums: false,
        onlyBassDrums: false,
    },
    scale: 'Minor',
    programMode: 'Continuous Flow',

    activeStationId: STATIONS[0].id,
    nowPlaying: 'Ready. Select a station...',
    stations: STATIONS,

    listenerCounts: {
        'feel-good-1': 1240,
        'lofi-1': 840,
        'techno-1': 2100,
        'jazz-1': 450,
        'afro-1': 3420,
        'synth-1': 920,
        'ambient-1': 1800,
    },
    schedule: {
        current: 'Loading...',
        next: 'Up Next',
        later: 'Later',
        remaining: 45
    },

    logs: [],
    seed: Date.now(),
};

function radioReducer(state: RadioState, action: RadioAction): RadioState {
    switch (action.type) {
        case 'SET_STATUS':
            return { ...state, status: action.status };
        case 'SET_API_KEY':
            return { ...state, apiKey: action.key };
        case 'SET_PROMPT':
            return { ...state, prompt: action.prompt };
        case 'UPDATE_PARAMS':
            return { ...state, ...action.payload };
        case 'TOGGLE_MIX_OPTION':
            return {
                ...state,
                mixOptions: {
                    ...state.mixOptions,
                    [action.option]: !state.mixOptions[action.option],
                },
            };
        case 'ADD_LOG': {
            const newLog = {
                id: Math.random().toString(36).substr(2, 9),
                ts: new Date(),
                text: action.text,
                level: action.level || 'info',
            };
            return { ...state, logs: [...state.logs, newLog] };
        }
        case 'REGENERATE_SEED':
            return { ...state, seed: Date.now() };
        case 'CLEAR_LOGS':
            return { ...state, logs: [] };
        case 'SWITCH_STATION': {
            const station = STATIONS.find(s => s.id === action.stationId);
            return {
                ...state,
                activeStationId: action.stationId,
                prompt: station ? station.name : state.prompt
            };
        }
        case 'UPDATE_NOW_PLAYING':
            return { ...state, nowPlaying: action.text };
        case 'SET_PROGRAM_MODE':
            return { ...state, programMode: action.mode };
        case 'UPDATE_LISTENERS':
            return { ...state, listenerCounts: action.counts };
        case 'UPDATE_SCHEDULE':
            return { ...state, schedule: action.schedule };
        default:
            return state;
    }
}

export function RadioProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(radioReducer, initialState);

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const bassFilterRef = useRef<BiquadFilterNode | null>(null);
    const trebleFilterRef = useRef<BiquadFilterNode | null>(null);

    const audioA = useRef<HTMLAudioElement | null>(null);
    const audioB = useRef<HTMLAudioElement | null>(null);
    const gainA = useRef<GainNode | null>(null);
    const gainB = useRef<GainNode | null>(null);

    const activePlayer = useRef<'A' | 'B'>('A');

    const initAudio = () => {
        if (audioContextRef.current) return;

        // @ts-expect-error Typescript doesn't know about webkitAudioContext
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();

        const ana = ctx.createAnalyser();
        ana.fftSize = 256;

        const bassFilter = ctx.createBiquadFilter();
        bassFilter.type = 'highpass';
        bassFilter.frequency.value = 0;

        const trebleFilter = ctx.createBiquadFilter();
        trebleFilter.type = 'lowpass';
        trebleFilter.frequency.value = 24000;

        const elA = new Audio(); elA.crossOrigin = "anonymous"; elA.loop = true;
        const elB = new Audio(); elB.crossOrigin = "anonymous"; elB.loop = true;

        audioA.current = elA;
        audioB.current = elB;

        const sourceA = ctx.createMediaElementSource(elA);
        const sourceB = ctx.createMediaElementSource(elB);

        const gA = ctx.createGain();
        const gB = ctx.createGain();

        gA.gain.value = 1;
        gB.gain.value = 0;

        gainA.current = gA;
        gainB.current = gB;

        sourceA.connect(gA);
        gA.connect(bassFilter);

        sourceB.connect(gB);
        gB.connect(bassFilter);

        bassFilter.connect(trebleFilter);
        trebleFilter.connect(ana);
        ana.connect(ctx.destination);

        audioContextRef.current = ctx;
        analyserRef.current = ana;
        bassFilterRef.current = bassFilter;
        trebleFilterRef.current = trebleFilter;

        if (state.stations.length > 0) {
            const urls = state.stations[0].sourceUrls;
            elA.src = urls[Math.floor(Math.random() * urls.length)];
        }

        dispatch({ type: 'ADD_LOG', text: 'Broadcast Audio Engine Initialized (Dual-Source)' });
    };

    useEffect(() => {
        const ctx = audioContextRef.current;
        if (!ctx || state.status !== 'PLAYING') {
            return;
        }

        const targetStation = state.stations.find(s => s.id === state.activeStationId);
        if (!targetStation) return;

        const currentAudio = activePlayer.current === 'A' ? audioA.current : audioB.current;
        const currentGain = activePlayer.current === 'A' ? gainA.current : gainB.current;

        const nextAudio = activePlayer.current === 'A' ? audioB.current : audioA.current;
        const nextGain = activePlayer.current === 'A' ? gainB.current : gainA.current;
        const nextPlayerId = activePlayer.current === 'A' ? 'B' : 'A';

        const performCrossfade = async () => {
            if (!nextAudio || !nextGain || !currentGain || !currentAudio) return;
            const isAlreadyPlayingStation = targetStation.sourceUrls.some(url => nextAudio.src.includes(url));
            if (isAlreadyPlayingStation && !nextAudio.paused) return;

            console.log(`Crossfading to ${targetStation.name} on Player ${nextPlayerId}`);
            dispatch({ type: 'ADD_LOG', text: `Crossfading to ${targetStation.name}...` });

            const randomUrl = targetStation.sourceUrls[Math.floor(Math.random() * targetStation.sourceUrls.length)];
            nextAudio.src = randomUrl;

            // Re-attach auto-shuffle listener on new tracks
            nextAudio.onended = () => {
                const nextRandomUrl = targetStation.sourceUrls[Math.floor(Math.random() * targetStation.sourceUrls.length)];
                nextAudio.src = nextRandomUrl;
                nextAudio.play().catch(e => console.error('Auto-shuffle failed', e));
                dispatch({ type: 'ADD_LOG', text: `Shuffled to next track in ${targetStation.name}` });
            };

            nextAudio.volume = 1;
            nextGain.gain.setValueAtTime(0, ctx.currentTime);

            try {
                await nextAudio.play();

                const FADE_TIME = 2.0;
                const now = ctx.currentTime;

                nextGain.gain.linearRampToValueAtTime(1, now + FADE_TIME);

                currentGain.gain.setValueAtTime(1, now);
                currentGain.gain.linearRampToValueAtTime(0, now + FADE_TIME);

                activePlayer.current = nextPlayerId;

                setTimeout(() => {
                    currentAudio.pause();
                    currentAudio.currentTime = 0;
                }, FADE_TIME * 1000 + 100);

            } catch (e) {
                console.error('Crossfade failed', e);
                dispatch({ type: 'ADD_LOG', text: 'Crossfade failed, retrying...', level: 'error' });
            }
        };

        performCrossfade();

    }, [state.activeStationId, state.stations, state.status]);

    const togglePlay = async () => {
        if (!audioContextRef.current) initAudio();
        const ctx = audioContextRef.current;
        if (ctx?.state === 'suspended') await ctx.resume();

        const player = activePlayer.current === 'A' ? audioA.current : audioB.current;
        const gain = activePlayer.current === 'A' ? gainA.current : gainB.current;

        if (state.status === 'PLAYING') {
            player?.pause();
            dispatch({ type: 'SET_STATUS', status: 'PAUSED' });
        } else {
            if (player) {
                if (!player.src) {
                    const s = state.stations.find(st => st.id === state.activeStationId);
                    if (s) {
                        player.src = s.sourceUrls[Math.floor(Math.random() * s.sourceUrls.length)];

                        // Ensure auto-play on track end
                        player.onended = () => {
                            const nextUrl = s.sourceUrls[Math.floor(Math.random() * s.sourceUrls.length)];
                            player.src = nextUrl;
                            player.play().catch(e => console.error(e));
                            dispatch({ type: 'ADD_LOG', text: `Shuffled to next track in ${s.name}` });
                        };
                    }
                }
                gain?.gain.cancelScheduledValues(ctx!.currentTime);
                gain?.gain.setValueAtTime(1, ctx!.currentTime);

                player.play().then(() => {
                    dispatch({ type: 'SET_STATUS', status: 'PLAYING' });
                }).catch(() => {
                    dispatch({ type: 'ADD_LOG', text: 'Playback failed.', level: 'error' });
                });
            }
        }
    };

    const stop = () => {
        const player = activePlayer.current === 'A' ? audioA.current : audioB.current;
        player?.pause();
        if (player) player.currentTime = 0;
        dispatch({ type: 'SET_STATUS', status: 'STOPPED' });
        dispatch({ type: 'ADD_LOG', text: 'Broadcast stopped.' });
    };

    useEffect(() => {
        const interval = setInterval(() => {
            const newCounts = { ...state.listenerCounts };
            let changed = false;

            Object.keys(newCounts).forEach(id => {
                const change = Math.floor(Math.random() * 11) - 5;
                newCounts[id] = Math.max(0, newCounts[id] + change);
                if (change !== 0) changed = true;
            });

            if (changed) {
                dispatch({ type: 'UPDATE_LISTENERS', counts: newCounts });
            }
        }, 8000);
        return () => clearInterval(interval);
    }, [state.listenerCounts]);

    useEffect(() => {
        const id = setInterval(() => {
            if (state.schedule.remaining > 0) {
                dispatch({
                    type: 'UPDATE_SCHEDULE',
                    schedule: { ...state.schedule, remaining: state.schedule.remaining - 1 }
                });
            } else {
                const station = state.stations.find(s => s.id === state.activeStationId);
                if (station) {
                    const next = state.schedule.next;
                    const later = state.schedule.later;
                    const newLater = station.mockSegments[Math.floor(Math.random() * station.mockSegments.length)];

                    let min = 30, max = 60;
                    switch (state.programMode) {
                        case 'Experimental': min = 15; max = 30; break;
                        case 'Pulse / Groove': min = 25; max = 45; break;
                        case 'After Hours': min = 60; max = 120; break;
                        default: min = 45; max = 90;
                    }
                    const duration = Math.floor(Math.random() * (max - min)) + min;

                    dispatch({
                        type: 'UPDATE_SCHEDULE',
                        schedule: {
                            current: next,
                            next: later,
                            later: newLater,
                            remaining: duration
                        }
                    });
                    dispatch({ type: 'UPDATE_NOW_PLAYING', text: next });
                    dispatch({ type: 'ADD_LOG', text: `Block advanced: ${next}` });
                }
            }
        }, 1000);
        return () => clearInterval(id);
    }, [state.schedule, state.activeStationId, state.programMode, state.stations]);

    useEffect(() => {
        const ctx = audioContextRef.current;
        if (!ctx || !bassFilterRef.current || !trebleFilterRef.current) return;

        const now = ctx.currentTime;

        // 1. Density -> Bass Filter (Highpass)
        // If density is 1.0 (full), cutoff is 0Hz (allow all).
        // If density is 0.0 (thin), cutoff is up to 1000Hz.
        const densityCutoff = (1.0 - state.density) * 1000;
        const bassFreq = state.mixOptions.muteBass ? 400 : densityCutoff;
        bassFilterRef.current.frequency.setTargetAtTime(bassFreq, now, 0.1);

        // 2. Brightness -> Treble Filter (Lowpass)
        // If brightness is 1.0 (bright), cutoff is 20000Hz (allow all).
        // If brightness is 0.0 (dark/muffled), cutoff is down to 500Hz.
        const brightnessCutoff = 500 + (state.brightness * 19500);
        const trebleFreq = state.mixOptions.onlyBassDrums ? 600 : brightnessCutoff;
        trebleFilterRef.current.frequency.setTargetAtTime(trebleFreq, now, 0.1);

        // 3. Speed (BPM) -> Playback Rate
        // Base is 120 BPM. So 60 BPM is 0.5x speed, 180 BPM is 1.5x speed.
        const targetRate = state.bpm / 120;
        if (audioA.current) audioA.current.playbackRate = targetRate;
        if (audioB.current) audioB.current.playbackRate = targetRate;

    }, [state.mixOptions, state.density, state.brightness, state.bpm]);

    return (
        <RadioContext.Provider value={{ state, dispatch }}>
            <AudioRefsContext.Provider value={{
                audioContext: audioContextRef,
                analyser: analyserRef,
                audioElement: audioA,
                initAudio,
                togglePlay,
                stop
            }}>
                {children}
            </AudioRefsContext.Provider>
        </RadioContext.Provider>
    );
}
