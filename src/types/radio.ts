export type RadioStatus = 'IDLE' | 'BUFFERING' | 'PLAYING' | 'PAUSED' | 'STOPPED' | 'ERROR';
export type LogLevel = 'info' | 'warn' | 'error';
export type UserRole = 'streamer' | 'listener';
export type BroadcastStatus = 'STANDBY' | 'COUNTDOWN' | 'LIVE';

export type LogType = 'SYSTEM' | 'FAN_REACTION' | 'FAN_COMMENT' | 'FAN_GIFT';

export interface LogEntry {
    id: string;
    ts: Date;
    text: string;
    level: LogLevel;
    type?: LogType;
    user?: string; // For fan comments/reactions
}

export interface Track {
    id: string;
    instanceId?: string; // Unique ID for specific queue/playlist instance
    title: string;
    artist: string;
    bpm: number;
    url: string;
    duration?: number;
}

export interface Playlist {
    id: string;
    name: string;
    description: string;
    tracks: Track[];
    tags: string[];
    linkedSources?: MusicSource[];
}

export interface SpotifyPlaylist {
    id: string;
    name: string;
    tracksCount: number;
    imageUrl?: string;
}

export interface MusicSource {
    id: string;
    type: 'spotify' | 'apple' | 'youtube' | 'local';
    name: string;
    connected: boolean;
    accessToken?: string;
    playlists?: SpotifyPlaylist[];
}

export interface MixOptions {
    muteBass: boolean;
    muteDrums: boolean;
    onlyBassDrums: boolean;
}

export type ProgramMode = 'Continuous Flow' | 'Pulse / Groove' | 'Golden Hour' | 'After Hours' | 'Experimental';

export interface RadioState {
    status: RadioStatus;
    broadcastStatus: BroadcastStatus;
    role: UserRole;
    apiKey: string;
    prompt: string;
    bpm: number;
    density: number;
    brightness: number;
    mixOptions: MixOptions;
    scale: string;
    programMode: ProgramMode;

    // Real Audio Props
    activePlaylistId: string;
    nowPlaying: string;
    playlists: Playlist[];
    library: Track[]; // Global pool of all ingested tracks

    // New Broadcast Props
    listenerCounts: Record<string, number>;
    schedule: {
        current: Track | null;
        queue: Track[]; // Upcoming tracks
        history: Track[]; // Past tracks
        remaining: number; // seconds
    };

    logs: LogEntry[];
    seed: number;

    // Mic & Ducking
    micActive: boolean;
    micGain: number;
    duckingIntensity: number;

    // Financial Core
    wallet: {
        total: number;
        session: number;
        history: WalletEntry[];
        isVaultOpen: boolean;
    };

    crossfadeLength: number;
}

export interface WalletEntry {
    id: string;
    user: string;
    amount: number;
    item: string;
    ts: Date;
}

export type RadioAction =
    | { type: 'SET_STATUS'; status: RadioStatus }
    | { type: 'SET_ROLE'; role: UserRole }
    | { type: 'SET_API_KEY'; key: string }
    | { type: 'SET_PROMPT'; prompt: string }
    | { type: 'UPDATE_PARAMS'; payload: Partial<Pick<RadioState, 'bpm' | 'density' | 'brightness' | 'scale'>> }
    | { type: 'TOGGLE_MIX_OPTION'; option: keyof MixOptions }
    | { type: 'ADD_LOG'; text: string; level?: LogLevel; logType?: LogType; user?: string }
    | { type: 'REGENERATE_SEED' }
    | { type: 'CLEAR_LOGS' }
    | { type: 'SWITCH_STATION'; stationId: string }
    | { type: 'UPDATE_NOW_PLAYING'; text: string }
    | { type: 'SET_PROGRAM_MODE'; mode: ProgramMode }
    | { type: 'UPDATE_LISTENERS'; counts: Record<string, number> }
    | { type: 'UPDATE_SCHEDULE'; schedule: RadioState['schedule'] }
    | { type: 'ADD_SOURCE'; playlistId: string; source: MusicSource }
    | { type: 'SET_BROADCAST_STATUS'; status: BroadcastStatus }
    | { type: 'CONNECT_SPOTIFY'; playlistId: string; token: string; playlists: SpotifyPlaylist[] }
    | { type: 'SET_MIC_ACTIVE'; active: boolean }
    | { type: 'SET_MIC_GAIN'; gain: number }
    | { type: 'SET_DUCKING'; intensity: number }
    | { type: 'REORDER_QUEUE'; queue: Track[] }
    | { type: 'CREATE_PLAYLIST'; name: string; tracks?: Track[] }
    | { type: 'ADD_TO_LIBRARY'; tracks: Track[] }
    | { type: 'ADD_TO_PLAYLIST'; playlistId: string; track: Track }
    | { type: 'REORDER_PLAYLIST'; playlistId: string; tracks: Track[] }
    | { type: 'SWITCH_PLAYLIST'; playlistId: string }
    | { type: 'DEPOSIT_HYPE'; amount: number; user: string; item: string }
    | { type: 'TOGGLE_VAULT'; open?: boolean }
    | { type: 'SET_CROSSFADE_LENGTH'; length: number }
    | { type: 'REMOVE_FROM_QUEUE'; instanceId: string }
    | { type: 'REMOVE_FROM_PLAYLIST'; playlistId: string; instanceId: string }
    | { type: 'REMOVE_FROM_LIBRARY'; trackId: string }
    | { type: 'FORCE_NEXT'; overrideTrack: Track };
