import { useReducer, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { RadioContext, AudioRefsContext } from './RadioContexts';
import { RadioState, RadioAction, Playlist, MusicSource, Track } from '../types/radio';

const FX_ASSETS: Record<string, string> = {
    AIRHORN: 'https://assets.mixkit.co/sfx/preview/mixkit-stadium-air-horn-loud-and-clear-1123.mp3',
    REWIND: 'https://assets.mixkit.co/sfx/preview/mixkit-tape-rewind-vibration-2023.mp3',
    DROP: 'https://assets.mixkit.co/sfx/preview/mixkit-electronic-retro-glitch-drop-2495.mp3',
    HYPE: 'https://assets.mixkit.co/sfx/preview/mixkit-cinematic-impact-braam-sound-2542.mp3'
};

const initialState: RadioState = {
    status: 'IDLE',
    broadcastStatus: 'STANDBY',
    role: 'listener',
    apiKey: '',
    prompt: '',
    bpm: 120,
    density: 1.0,
    brightness: 1.0,
    mixOptions: {
        muteBass: false,
        muteDrums: false,
        onlyBassDrums: false,
    },
    scale: 'Minor',
    programMode: 'Continuous Flow',

    activePlaylistId: '',
    nowPlaying: 'Create a playlist to get started...',
    playlists: [],
    library: [],

    listenerCounts: {},
    schedule: {
        current: null,
        queue: [],
        history: [],
        remaining: 0
    },

    logs: [],
    seed: Math.random(),

    micActive: false,
    micGain: 1.0,
    duckingIntensity: 0.6,
    wallet: {
        total: 0,
        session: 0,
        history: [],
        isVaultOpen: false
    },
    crossfadeLength: 2.0
};

function radioReducer(state: RadioState, action: RadioAction): RadioState {
    switch (action.type) {
        case 'SET_STATUS':
            return { ...state, status: action.status };
        case 'SET_ROLE':
            return { ...state, role: action.role };
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
                type: action.logType || 'SYSTEM',
                user: action.user
            };
            // Keep logs reasonable - 100 entries
            const newLogs = [...state.logs, newLog].slice(-100);
            return { ...state, logs: newLogs };
        }
        case 'REGENERATE_SEED':
            return { ...state, seed: Date.now() };
        case 'CLEAR_LOGS':
            return { ...state, logs: [] };
        case 'SWITCH_PLAYLIST': {
            const playlist = state.playlists.find(p => p.id === action.playlistId);
            if (!playlist) return state;

            const tracksWithInstances = playlist.tracks.map(t => ({
                ...t,
                instanceId: t.instanceId || `${t.id}-${Math.random().toString(36).substr(2, 9)}`
            }));

            const initialTrack = tracksWithInstances[0];
            const nowPlayingText = initialTrack
                ? (initialTrack.artist && initialTrack.artist !== 'Unknown Artist' ? `${initialTrack.title} - ${initialTrack.artist}` : initialTrack.title)
                : playlist.name;

            return {
                ...state,
                activePlaylistId: action.playlistId,
                prompt: playlist.name,
                nowPlaying: nowPlayingText,
                schedule: {
                    current: initialTrack || null,
                    queue: tracksWithInstances.slice(1, 10),
                    history: [],
                    remaining: 180
                }
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
        case 'REORDER_QUEUE':
            return { ...state, schedule: { ...state.schedule, queue: action.queue } };
        case 'SET_BROADCAST_STATUS':
            return { ...state, broadcastStatus: action.status };
        case 'SET_MIC_ACTIVE':
            return { ...state, micActive: action.active };
        case 'SET_MIC_GAIN':
            return { ...state, micGain: action.gain };
        case 'SET_DUCKING':
            return { ...state, duckingIntensity: action.intensity };
        case 'CONNECT_SPOTIFY': {
            const updatedPlaylists = state.playlists.map(p => {
                if (p.id === action.playlistId) {
                    const existingSources = p.linkedSources || [];
                    const otherSources = existingSources.filter(src => src.type !== 'spotify');
                    const spotifySource: MusicSource = {
                        id: 'spotify-root',
                        type: 'spotify',
                        name: 'Spotify Account',
                        connected: true,
                        accessToken: action.token,
                        playlists: action.playlists
                    };
                    return {
                        ...p,
                        linkedSources: [...otherSources, spotifySource]
                    };
                }
                return p;
            });
            return { ...state, playlists: updatedPlaylists };
        }
        case 'ADD_SOURCE': {
            const updatedPlaylists = state.playlists.map(p => {
                if (p.id === action.playlistId) {
                    return {
                        ...p,
                        linkedSources: [...(p.linkedSources || []), action.source]
                    };
                }
                return p;
            });
            return { ...state, playlists: updatedPlaylists };
        }
        case 'CREATE_PLAYLIST': {
            const newPlaylist: Playlist = {
                id: Math.random().toString(36).substr(2, 9),
                name: action.name,
                description: 'User created playlist',
                tracks: action.tracks || [],
                tags: ['User']
            };
            const firstTrack = action.tracks?.[0];
            const nowPlayingText = state.activePlaylistId
                ? state.nowPlaying
                : (firstTrack ? (firstTrack.artist && firstTrack.artist !== 'Unknown Artist' ? `${firstTrack.title} - ${firstTrack.artist}` : firstTrack.title) : action.name);

            const initialSchedule = !state.activePlaylistId && firstTrack ? {
                current: firstTrack,
                queue: (action.tracks || []).slice(1, 10),
                history: [],
                remaining: 180
            } : state.schedule;

            return {
                ...state,
                playlists: [...state.playlists, newPlaylist],
                activePlaylistId: state.activePlaylistId || newPlaylist.id,
                nowPlaying: nowPlayingText,
                schedule: initialSchedule
            };
        }
        case 'ADD_TO_LIBRARY': {
            const tracksWithInstances = action.tracks.map(t => ({
                ...t,
                instanceId: t.instanceId || `${t.id}-${Math.random().toString(36).substr(2, 9)}`
            }));
            return { ...state, library: [...state.library, ...tracksWithInstances] };
        }
        case 'ADD_TO_PLAYLIST': {
            const trackWithInstance = {
                ...action.track,
                instanceId: `${action.track.id}-${Math.random().toString(36).substr(2, 9)}`
            };
            const targetPlaylistId = action.playlistId || state.activePlaylistId || (state.playlists.length > 0 ? state.playlists[0].id : null);

            const updatedPlaylists = state.playlists.map(p => {
                if (p.id === targetPlaylistId) {
                    return { ...p, tracks: [...p.tracks, trackWithInstance] };
                }
                return p;
            });

            // Sync with active schedule if we are adding to the current playlist
            let newSchedule = state.schedule;
            if (targetPlaylistId === (state.activePlaylistId || targetPlaylistId)) {
                if (!state.schedule.current) {
                    newSchedule = {
                        ...state.schedule,
                        current: trackWithInstance,
                        remaining: 180,
                        history: state.schedule.history || []
                    };
                } else if (state.schedule.queue.length < 10) { // Allow larger queue visibility
                    newSchedule = {
                        ...state.schedule,
                        queue: [...state.schedule.queue, trackWithInstance],
                        history: state.schedule.history || []
                    };
                }
            }

            const finalNowPlaying = (!state.schedule.current || state.nowPlaying === 'Create a playlist to get started...')
                ? (trackWithInstance.artist && trackWithInstance.artist !== 'Unknown Artist' ? `${trackWithInstance.title} - ${trackWithInstance.artist}` : trackWithInstance.title)
                : state.nowPlaying;

            return {
                ...state,
                playlists: updatedPlaylists,
                schedule: newSchedule,
                activePlaylistId: state.activePlaylistId || (targetPlaylistId as string),
                nowPlaying: finalNowPlaying
            };
        }
        case 'REORDER_PLAYLIST': {
            const updatedPlaylists = state.playlists.map(p => {
                if (p.id === action.playlistId) {
                    return { ...p, tracks: action.tracks };
                }
                return p;
            });
            return { ...state, playlists: updatedPlaylists };
        }
        case 'DEPOSIT_HYPE': {
            const newEntry = {
                id: Math.random().toString(36).substr(2, 9),
                user: action.user,
                amount: action.amount,
                item: action.item,
                ts: new Date()
            };
            return {
                ...state,
                wallet: {
                    ...state.wallet,
                    total: state.wallet.total + action.amount,
                    session: state.wallet.session + action.amount,
                    history: [newEntry, ...state.wallet.history].slice(0, 50)
                }
            };
        }
        case 'TOGGLE_VAULT':
            return {
                ...state,
                wallet: {
                    ...state.wallet,
                    isVaultOpen: typeof action.open === 'boolean' ? action.open : !state.wallet.isVaultOpen
                }
            };
        case 'SET_CROSSFADE_LENGTH':
            return {
                ...state,
                crossfadeLength: action.length
            };
        case 'REMOVE_FROM_QUEUE': {
            const newQueue = state.schedule.queue.filter(t => t.instanceId !== action.instanceId);
            return {
                ...state,
                schedule: { ...state.schedule, queue: newQueue }
            };
        }
        case 'REMOVE_FROM_PLAYLIST': {
            const updatedPlaylists = state.playlists.map(p => {
                if (p.id === action.playlistId) {
                    return { ...p, tracks: p.tracks.filter(t => t.instanceId !== action.instanceId) };
                }
                return p;
            });
            return { ...state, playlists: updatedPlaylists };
        }
        case 'REMOVE_FROM_LIBRARY': {
            const newLibrary = state.library.filter(t => t.id !== action.trackId);
            // Also remove from all playlists for consistency
            const updatedPlaylists = state.playlists.map(p => ({
                ...p,
                tracks: p.tracks.filter(t => t.id !== action.trackId)
            }));
            // Also remove from queue
            const newQueue = state.schedule.queue.filter(t => t.id !== action.trackId);

            return {
                ...state,
                library: newLibrary,
                playlists: updatedPlaylists,
                schedule: { ...state.schedule, queue: newQueue }
            };
        }
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
    const fxBuffers = useRef<Record<string, AudioBuffer>>({});
    const duckingGainRef = useRef<GainNode | null>(null);
    const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const micGainRef = useRef<GainNode | null>(null);
    const micAnalyserRef = useRef<AnalyserNode | null>(null);

    const audioA = useRef<HTMLAudioElement | null>(null);
    const audioB = useRef<HTMLAudioElement | null>(null);
    const gainA = useRef<GainNode | null>(null);
    const gainB = useRef<GainNode | null>(null);

    const activePlayer = useRef<'A' | 'B'>('A');
    const lastPlayedStationId = useRef<string | null>(null);
    const stationQueues = useRef<Record<string, Track[]>>({});
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // Helper to shuffle an array
    const shuffleArray = <T,>(array: T[]): T[] => {
        const newArr = [...array];
        for (let i = newArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
    };

    // Helper to get next track for a station without repeating
    const getNextTrack = useCallback((stationId: string, tracks: Track[], currentUrl?: string): Track => {
        if (!stationQueues.current[stationId] || stationQueues.current[stationId].length === 0) {
            // Refill and shuffle the queue
            const shuffled = shuffleArray(tracks);
            // If the first song in new deck is the same as the last played song, swap it
            if (currentUrl && currentUrl.includes(shuffled[0].url) && shuffled.length > 1) {
                [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
            }
            stationQueues.current[stationId] = shuffled;
        }

        const queue = stationQueues.current[stationId];
        if (!queue || queue.length === 0) return null as any;

        // Always check: if the next track is the currently playing song, skip it
        if (currentUrl && queue.length > 1) {
            const nextIndex = queue.findIndex((track: Track) => !currentUrl.includes(track.url));
            if (nextIndex > 0) {
                const [track] = queue.splice(nextIndex, 1);
                queue.unshift(track);
            }
        }

        return queue.shift();
    }, []);

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

        const duckingGain = ctx.createGain();
        duckingGain.gain.value = 1.0;
        duckingGainRef.current = duckingGain;

        const elA = new Audio(); elA.loop = false;
        const elB = new Audio(); elB.loop = false;

        const applyAudioSrc = (el: HTMLAudioElement, url: string) => {
            console.log(`[Audio Engine] Loading signal: ${url.substring(0, 50)}...`);
            if (url.startsWith('blob:') || url.startsWith('data:')) {
                console.log('[Audio Engine] Scheme: BLOB/DATA - Removing crossOrigin');
                el.removeAttribute('crossorigin');
            } else {
                console.log('[Audio Engine] Scheme: REMOTE - Setting crossOrigin=anonymous');
                el.crossOrigin = 'anonymous';
            }
            el.src = url;
            el.load(); // Explicitly trigger load
        };

        elA.onerror = (e) => console.error('[Audio Engine] Player A Error:', e, elA.error);
        elB.onerror = (e) => console.error('[Audio Engine] Player B Error:', e, elB.error);

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
        trebleFilter.connect(duckingGain);
        duckingGain.connect(ana);
        ana.connect(ctx.destination);

        audioContextRef.current = ctx;
        analyserRef.current = ana;
        bassFilterRef.current = bassFilter;
        trebleFilterRef.current = trebleFilter;

        if (state.playlists.length > 0) {
            const s = state.playlists[0];
            const track = getNextTrack(s.id, s.tracks);
            applyAudioSrc(elA, track.url);
        }

        dispatch({ type: 'ADD_LOG', text: 'Broadcast Audio Engine Initialized (Dual-Source)' });
    };

    useEffect(() => {
        const loadFX = async () => {
            // @ts-expect-error webkitAudioContext is a legacy Safari feature
            const Ctx = window.AudioContext || window.webkitAudioContext;
            const ctx = new Ctx();
            const buffers: Record<string, AudioBuffer> = {};

            for (const [key, url] of Object.entries(FX_ASSETS)) {
                try {
                    const response = await fetch(url);
                    const arrayBuffer = await response.arrayBuffer();
                    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                    buffers[key] = audioBuffer;
                } catch (e) {
                    console.warn(`Failed to load FX: ${key}`, e);
                }
            }
            fxBuffers.current = buffers;
            console.log('Studio FX Assets Pre-loaded');
        };
        loadFX();
    }, []);

    const triggerFX = useCallback((label: string) => {
        const ctx = audioContextRef.current;
        const buffer = fxBuffers.current[label];
        const ana = analyserRef.current;

        if (!ctx || !buffer || !ana) return;

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gainNode = ctx.createGain();
        gainNode.gain.value = 0.8; // SFX slightly lower to not clip

        source.connect(gainNode);
        gainNode.connect(ana); // Inject directly into analyser for visuals

        source.start(0);
        console.log(`Triggered SFX: ${label}`);
    }, []);

    const toggleMic = async () => {
        if (!audioContextRef.current) initAudio();
        const ctx = audioContextRef.current!;

        if (state.micActive) {
            // Disable Mic
            if (micSourceRef.current) {
                micSourceRef.current.disconnect();
                micSourceRef.current = null;
            }
            dispatch({ type: 'SET_MIC_ACTIVE', active: false });
            dispatch({ type: 'ADD_LOG', text: 'Microphone Offline' });
        } else {
            // Enable Mic
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const source = ctx.createMediaStreamSource(stream);
                const g = ctx.createGain();
                const mAna = ctx.createAnalyser();
                mAna.fftSize = 32; // Small for just peak detection

                g.gain.value = state.micGain;
                source.connect(g);
                g.connect(mAna);
                g.connect(analyserRef.current!); // Connect to master analyser for visuals

                micSourceRef.current = source;
                micGainRef.current = g;
                micAnalyserRef.current = mAna;

                dispatch({ type: 'SET_MIC_ACTIVE', active: true });
                dispatch({ type: 'ADD_LOG', text: 'Microphone LIVE' });
            } catch (e) {
                console.error('Mic access failed', e);
                dispatch({ type: 'ADD_LOG', text: 'Mic Access Denied', level: 'error' });
            }
        }
    };

    // Auto-Ducking Loop
    useEffect(() => {
        if (!state.micActive || !micAnalyserRef.current || !duckingGainRef.current) {
            // Reset gain if mic inactive
            if (duckingGainRef.current) {
                duckingGainRef.current.gain.setTargetAtTime(1.0, audioContextRef.current?.currentTime || 0, 0.1);
            }
            return;
        }

        const mAna = micAnalyserRef.current;
        const dGain = duckingGainRef.current;
        const ctx = audioContextRef.current!;
        const data = new Uint8Array(mAna.frequencyBinCount);
        let rafId: number;

        const checkDucking = () => {
            mAna.getByteFrequencyData(data);
            const peak = Math.max(...data) / 255;

            // If peak > 0.1 (talking), duck the music
            const targetGain = peak > 0.1 ? (1.0 - state.duckingIntensity) : 1.0;
            dGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.05);

            rafId = requestAnimationFrame(checkDucking);
        };

        checkDucking();
        return () => cancelAnimationFrame(rafId);
    }, [state.micActive, state.duckingIntensity]);

    const triggerCrossfadeRef = useRef<(stationId?: string) => Promise<void>>();

    const triggerCrossfade = useCallback(async (targetStationId?: string, overrideTrack?: Track, isSkipBack?: boolean) => {
        const ctx = audioContextRef.current;
        const currentState = stateRef.current;
        if (!ctx || currentState.status !== 'PLAYING') return;

        const effectiveStationId = targetStationId || currentState.activePlaylistId;
        const targetStation = currentState.playlists.find((s: Playlist) => s.id === effectiveStationId);
        if (!targetStation) return;

        const currentAudio = activePlayer.current === 'A' ? audioA.current : audioB.current;
        const currentGain = activePlayer.current === 'A' ? gainA.current : gainB.current;

        const nextAudio = activePlayer.current === 'A' ? audioB.current : audioA.current;
        const nextGain = activePlayer.current === 'A' ? gainB.current : gainA.current;
        const nextPlayerId = activePlayer.current === 'A' ? 'B' : 'A';

        if (!nextAudio || !nextGain || !currentGain || !currentAudio) return;

        console.log(`Crossfading to ${targetStation.name} on Player ${nextPlayerId}`);
        dispatch({ type: 'ADD_LOG', text: `Crossfading to next track in ${targetStation.name}...` });

        // Fix: Always prioritize the user's manual queue if it exists
        const manualQueue = stateRef.current.schedule.queue;
        const nextTrack = overrideTrack || (manualQueue.length > 0 ? manualQueue[0] : getNextTrack(targetStation.id, targetStation.tracks, currentAudio.src));

        if (!nextTrack) {
            console.warn('[Audio Engine] No next track available for crossfade');
            dispatch({ type: 'ADD_LOG', text: 'No tracks in current project. Ingest more music to continue.', level: 'error' });
            return;
        }

        // Use the same helper for dynamic crossOrigin
        if (nextTrack.url.startsWith('blob:') || nextTrack.url.startsWith('data:')) {
            nextAudio.removeAttribute('crossorigin');
        } else {
            nextAudio.crossOrigin = 'anonymous';
        }
        nextAudio.src = nextTrack.url;

        // Re-attach listener on new tracks
        nextAudio.onended = () => {
            triggerCrossfadeRef.current?.(targetStation.id);
        };

        nextAudio.volume = 1;
        nextGain.gain.setValueAtTime(0, ctx.currentTime);

        try {
            await nextAudio.play();
            const FADE_TIME = stateRef.current.crossfadeLength || 2.0;
            const now = ctx.currentTime;

            nextGain.gain.linearRampToValueAtTime(1, now + FADE_TIME);

            currentGain.gain.setValueAtTime(1, now);
            currentGain.gain.linearRampToValueAtTime(0, now + FADE_TIME);

            activePlayer.current = nextPlayerId;

            let nextQueue: Track[];
            let newHistory: Track[];

            if (isSkipBack) {
                // Skip Back: Push current back to queue, pop from history
                nextQueue = stateRef.current.schedule.current
                    ? [stateRef.current.schedule.current, ...stateRef.current.schedule.queue.slice(0, -1)]
                    : [...stateRef.current.schedule.queue];
                newHistory = stateRef.current.schedule.history.slice(0, -1);
            } else {
                // Skip Forward / Auto: Push current to history, shift queue
                newHistory = [...stateRef.current.schedule.history];
                if (stateRef.current.schedule.current) {
                    newHistory.push(stateRef.current.schedule.current);
                    if (newHistory.length > 50) newHistory.shift();
                }

                nextQueue = [...stateRef.current.schedule.queue.slice(1)];
                const newTrack = getNextTrack(targetStation.id, targetStation.tracks, nextTrack.url);
                nextQueue.push(newTrack);
            }

            dispatch({
                type: 'UPDATE_SCHEDULE',
                schedule: {
                    current: nextTrack,
                    queue: nextQueue,
                    history: newHistory,
                    remaining: 180
                }
            });
            const nowPlayingText = nextTrack.artist && nextTrack.artist !== 'Unknown Artist'
                ? `${nextTrack.title} - ${nextTrack.artist}`
                : nextTrack.title;
            dispatch({ type: 'UPDATE_NOW_PLAYING', text: nowPlayingText });

            setTimeout(() => {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }, FADE_TIME * 1000 + 100);

        } catch (e) {
            console.error('Crossfade failed', e);
            dispatch({ type: 'ADD_LOG', text: 'Crossfade failed, retrying...', level: 'error' });
        }
    }, [dispatch, getNextTrack]);

    const skipNext = useCallback(() => {
        triggerCrossfade();
    }, [triggerCrossfade]);

    const skipPrevious = useCallback(() => {
        const player = activePlayer.current === 'A' ? audioA.current : audioB.current;
        if (!player) return;

        // If we've played more than 3 seconds, just restart the song
        if (player.currentTime > 3) {
            player.currentTime = 0;
            return;
        }

        // Otherwise try to go to previous song
        const history = stateRef.current.schedule.history;
        if (history.length > 0) {
            const prevTrack = history[history.length - 1];
            triggerCrossfade(undefined, prevTrack, true);
        } else {
            player.currentTime = 0;
        }
    }, [triggerCrossfade]);

    useEffect(() => {
        triggerCrossfadeRef.current = triggerCrossfade;
    }, [triggerCrossfade]);

    useEffect(() => {
        if (state.status !== 'PLAYING') return;

        // Only crossfade if we've actually switched playlists
        if (lastPlayedStationId.current === state.activePlaylistId) return;
        lastPlayedStationId.current = state.activePlaylistId;

        triggerCrossfade();
    }, [state.activePlaylistId, state.status, triggerCrossfade]);

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
                    const s = state.playlists.find((st: Playlist) => st.id === state.activePlaylistId);
                    if (s) {
                        const track = getNextTrack(s.id, s.tracks);

                        if (!track) {
                            dispatch({ type: 'ADD_LOG', text: 'Nothing to play in this project.', level: 'error' });
                            return;
                        }

                        if (track.url.startsWith('blob:') || track.url.startsWith('data:')) {
                            player.removeAttribute('crossorigin');
                        } else {
                            player.crossOrigin = 'anonymous';
                        }
                        player.src = track.url;

                        // Ensure auto-play on track end
                        player.onended = () => {
                            triggerCrossfade(s.id);
                        };
                    }
                }
                gain?.gain.cancelScheduledValues(ctx!.currentTime);
                gain?.gain.setValueAtTime(1, ctx!.currentTime);

                player.play().then(() => {
                    dispatch({ type: 'SET_STATUS', status: 'PLAYING' });
                    // Sync initial display
                    const currentStation = state.playlists.find(s => s.id === state.activePlaylistId);
                    if (currentStation && state.schedule.current) {
                        const track = state.schedule.current;
                        const text = track.artist && track.artist !== 'Unknown Artist'
                            ? `${track.title} - ${track.artist}`
                            : track.title;
                        dispatch({ type: 'UPDATE_NOW_PLAYING', text });
                    }
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
            const currentState = stateRef.current;
            const newCounts = { ...currentState.listenerCounts };
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
    }, []);

    useEffect(() => {
        const id = setInterval(() => {
            const currentState = stateRef.current;
            if (currentState.status !== 'PLAYING') return;

            if (currentState.schedule.remaining > 0) {
                dispatch({
                    type: 'UPDATE_SCHEDULE',
                    schedule: { ...currentState.schedule, remaining: currentState.schedule.remaining - 1 }
                });
            } else {
                // Timer reached zero - trigger a REAL crossfade to keep audio in sync
                triggerCrossfade();
            }
        }, 1000);
        return () => clearInterval(id);
    }, [getNextTrack, triggerCrossfade]);

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
                stop,
                triggerFX,
                toggleMic,
                skipNext,
                skipPrevious
            }}>
                {children}
            </AudioRefsContext.Provider>
        </RadioContext.Provider>
    );
}
