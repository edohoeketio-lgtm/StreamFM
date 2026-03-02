/**
 * YoutubeService.ts
 * 
 * Provides background audio resolution for tracks lacking Spotify previews.
 * Uses Piped API (privacy-focused YouTube proxy) for searching and 
 * resolving CORS-friendly audio-only streams.
 */

const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://piped-api.lunar.icu',
    'https://pipedapi.leptons.xyz',
    'https://api-piped.mha.fi'
];

let currentInstanceIndex = 0;

const getPipedBase = () => PIPED_INSTANCES[currentInstanceIndex];
const rotateInstance = () => {
    currentInstanceIndex = (currentInstanceIndex + 1) % PIPED_INSTANCES.length;
    console.warn(`[YouTube Service] Rotating to instance: ${getPipedBase()}`);
};

const resolutionCache: Record<string, string> = {};

export interface YoutubeAudioResult {
    url: string;
    videoId: string;
}

export const YoutubeService = {
    /**
     * Cache a resolution URL for a track title + artist.
     */
    cacheResolution: (title: string, artist: string, url: string) => {
        const key = `${title}-${artist}`.toLowerCase();
        resolutionCache[key] = url;
    },

    /**
     * Get a cached resolution URL if it exists.
     */
    getCachedResolution: (title: string, artist: string) => {
        const key = `${title}-${artist}`.toLowerCase();
        return resolutionCache[key] || null;
    },
    /**
     * Search YouTube for a track by name and artist.
     * Returns the videoId of the best match.
     */
    searchTrack: async (title: string, artist: string): Promise<string | null> => {
        const fetchWithRetry = async (retryCount = 1): Promise<string | null> => {
            try {
                const query = encodeURIComponent(`${title} ${artist} topic`);
                const response = await fetch(`${getPipedBase()}/search?q=${query}&filter=videos`);

                if (!response.ok) throw new Error('YouTube search failed');

                const data = await response.json();
                const results = data.items || [];

                if (results.length > 0) {
                    return results[0].url.split('v=')[1] || results[0].url.split('/').pop() || null;
                }
                return null;
            } catch (err) {
                console.error(`[YouTube Service] Search failed on ${getPipedBase()}:`, err);
                if (retryCount > 0) {
                    rotateInstance();
                    return fetchWithRetry(retryCount - 1);
                }
                return null;
            }
        };
        return fetchWithRetry();
    },

    /**
     * Resolve a YouTube videoId to a direct, playable audio stream URL.
     */
    resolveAudioUrl: async (videoId: string): Promise<string | null> => {
        const fetchWithRetry = async (retryCount = 1): Promise<string | null> => {
            try {
                const response = await fetch(`${getPipedBase()}/streams/${videoId}`);

                if (!response.ok) throw new Error('YouTube stream resolution failed');

                const data = await response.json();
                const audioStreams: { url: string; mimeType: string }[] = data.audioStreams || [];

                const bestAudio = audioStreams.find(s => s.mimeType?.includes('audio/webm')) ||
                    audioStreams[0];

                return bestAudio?.url || null;
            } catch (err) {
                console.error(`[YouTube Service] Stream resolution failed on ${getPipedBase()}:`, err);
                if (retryCount > 0) {
                    rotateInstance();
                    return fetchWithRetry(retryCount - 1);
                }
                return null;
            }
        };
        return fetchWithRetry();
    },

    /**
     * Combined helper: Name/Artist -> Audio URL
     */
    resolveTrack: async (title: string, artist: string): Promise<YoutubeAudioResult | null> => {
        // Check cache first
        const cachedUrl = YoutubeService.getCachedResolution(title, artist);
        if (cachedUrl) {
            console.log(`[YouTube Service] Using cached resolution for: ${title}`);
            return { url: cachedUrl, videoId: 'cached' };
        }

        console.log(`[YouTube Service] Resolving full song for: ${title} - ${artist}`);

        const videoId = await YoutubeService.searchTrack(title, artist);
        if (!videoId) return null;

        const url = await YoutubeService.resolveAudioUrl(videoId);
        if (!url) return null;

        // Cache for future use
        YoutubeService.cacheResolution(title, artist, url);

        return { url, videoId };
    }
};
