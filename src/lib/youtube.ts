/**
 * YoutubeService.ts
 * 
 * Provides official YouTube playback support with a robust search fallback.
 * uses a curated list of Piped instances and a CORS proxy fallback to ensure
 * searching for Video IDs never fails.
 */

const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.tokyo.io',
    'https://piped-api.lunar.icu',
    'https://api.piped.li',
    'https://pipedapi.official-multimedia-group.de'
];

// CORS Proxy for fallback
const CORS_PROXY = 'https://api.allorigins.win/get?url=';

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
     * Uses a double-fallback strategy: Direct -> CORS Proxy -> Next Instance.
     */
    searchTrack: async (title: string, artist: string): Promise<string | null> => {
        const fetchWithRetry = async (retryCount = 2): Promise<string | null> => {
            const query = encodeURIComponent(`${title} ${artist} topic`);
            const baseUrl = getPipedBase();
            const searchUrl = `${baseUrl}/search?q=${query}&filter=videos`;

            const parseResults = (data: any) => {
                const results = data.items || [];
                if (results.length > 0) {
                    const url = results[0].url || '';
                    const id = url.includes('v=') ? url.split('v=')[1] : (url.split('/').pop() || '');
                    return id.split('&')[0];
                }
                return null;
            };

            try {
                console.log(`[YouTube Search] Trying Direct: ${baseUrl}`);
                const response = await fetch(searchUrl);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                return parseResults(data);
            } catch (err) {
                console.warn(`[YouTube Search] Direct failed on ${baseUrl}. Error: ${err}. Trying Proxy...`);

                // Fallback 1: CORS Proxy
                try {
                    const proxyUrl = `${CORS_PROXY}${encodeURIComponent(searchUrl)}`;
                    const response = await fetch(proxyUrl);
                    if (!response.ok) throw new Error(`Proxy HTTP ${response.status}`);

                    const proxyData = await response.json();
                    // allorigins returns the actual JSON string in 'contents'
                    const actualData = JSON.parse(proxyData.contents);
                    return parseResults(actualData);
                } catch (proxyErr) {
                    console.error(`[YouTube Search] Proxy failed on ${baseUrl}:`, proxyErr);

                    // Fallback 2: Rotate and Retry
                    if (retryCount > 0) {
                        rotateInstance();
                        return fetchWithRetry(retryCount - 1);
                    }
                }
            }
            return null;
        };

        return fetchWithRetry();
    },

    /**
     * Resolve Track -> YouTube Video URL
     */
    resolveTrack: async (track: { title: string, artist: string }): Promise<YoutubeAudioResult | null> => {
        const cachedId = YoutubeService.getCachedResolution(track.title, track.artist);
        let videoId = cachedId;

        if (!videoId) {
            videoId = await YoutubeService.searchTrack(track.title, track.artist);
            if (!videoId) return null;
            YoutubeService.cacheResolution(track.title, track.artist, videoId);
        }

        return {
            url: `https://www.youtube.com/watch?v=${videoId}`,
            videoId
        };
    }
};
