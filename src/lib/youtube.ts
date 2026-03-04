/**
 * YoutubeService.ts
 * 
 * Provides official YouTube playback support.
 * Instead of extracting direct streams (which is fragile), this service
 * focuses on finding the best Video ID for a track.
 */

const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.leptons.xyz',
    'https://piped-api.lunar.icu',
    'https://api-piped.mha.fi',
    'https://pipedapi-us.kavin.rocks',
    'https://piped-api.veris.nu',
    'https://api.piped.no'
];

let currentInstanceIndex = 0;
const getPipedBase = () => PIPED_INSTANCES[currentInstanceIndex];
const rotateInstance = () => {
    currentInstanceIndex = (currentInstanceIndex + 1) % PIPED_INSTANCES.length;
};

const resolutionCache: Record<string, string> = {};

export interface YoutubeAudioResult {
    url: string;
    videoId: string;
}

export const YoutubeService = {
    cacheResolution: (title: string, artist: string, videoId: string) => {
        const key = `${title}-${artist}`.toLowerCase();
        resolutionCache[key] = videoId;
    },

    getCachedResolution: (title: string, artist: string) => {
        const key = `${title}-${artist}`.toLowerCase();
        return resolutionCache[key] || null;
    },

    /**
     * Search YouTube for a track and return the official Video ID.
     */
    searchTrack: async (title: string, artist: string): Promise<string | null> => {
        const fetchWithRetry = async (retryCount = 1): Promise<string | null> => {
            try {
                const query = encodeURIComponent(`${title} ${artist} topic`);
                const response = await fetch(`${getPipedBase()}/search?q=${query}&filter=videos`);

                if (!response.ok) throw new Error('Search failed');

                const data = await response.json();
                const results = data.items || [];

                if (results.length > 0) {
                    // Extract video ID from URL or ID property
                    const url = results[0].url || '';
                    const id = url.includes('v=') ? url.split('v=')[1] : (url.split('/').pop() || '');
                    return id.split('&')[0];
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
     * Resolve Track -> YouTube Video URL
     */
    resolveTrack: async (title: string, artist: string): Promise<YoutubeAudioResult | null> => {
        const cachedId = YoutubeService.getCachedResolution(title, artist);
        let videoId = cachedId;

        if (!videoId) {
            videoId = await YoutubeService.searchTrack(title, artist);
            if (!videoId) return null;
            YoutubeService.cacheResolution(title, artist, videoId);
        }

        return {
            url: `https://www.youtube.com/watch?v=${videoId}`,
            videoId
        };
    }
};
