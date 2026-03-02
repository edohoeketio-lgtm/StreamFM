/**
 * YoutubeService.ts
 * 
 * Provides background audio resolution for tracks lacking Spotify previews.
 * Uses Piped API (privacy-focused YouTube proxy) for searching and 
 * resolving CORS-friendly audio-only streams.
 */

const PIPED_API_BASE = 'https://pipedapi.kavin.rocks';

export interface YoutubeAudioResult {
    url: string;
    videoId: string;
}

export const YoutubeService = {
    /**
     * Search YouTube for a track by name and artist.
     * Returns the videoId of the best match.
     */
    searchTrack: async (title: string, artist: string): Promise<string | null> => {
        try {
            const query = encodeURIComponent(`${title} ${artist} topic`);
            const response = await fetch(`${PIPED_API_BASE}/search?q=${query}&filter=videos`);

            if (!response.ok) throw new Error('YouTube search failed');

            const data = await response.json();
            const results = data.items || [];

            // Look for "topic" or high-confidence matches
            if (results.length > 0) {
                return results[0].url.split('v=')[1] || results[0].url.split('/').pop() || null;
            }

            return null;
        } catch (err) {
            console.error('[YouTube Service] Search failed:', err);
            return null;
        }
    },

    /**
     * Resolve a YouTube videoId to a direct, playable audio stream URL.
     */
    resolveAudioUrl: async (videoId: string): Promise<string | null> => {
        try {
            const response = await fetch(`${PIPED_API_BASE}/streams/${videoId}`);

            if (!response.ok) throw new Error('YouTube stream resolution failed');

            const data = await response.json();

            // Find the best audio stream
            // Piped returns audioStreams array
            const audioStreams: { url: string; mimeType: string }[] = data.audioStreams || [];

            // Prefer opus or m4a
            const bestAudio = audioStreams.find(s => s.mimeType?.includes('audio/webm')) ||
                audioStreams[0];

            return bestAudio?.url || null;
        } catch (err) {
            console.error('[YouTube Service] Stream resolution failed:', err);
            return null;
        }
    },

    /**
     * Combined helper: Name/Artist -> Audio URL
     */
    resolveTrack: async (title: string, artist: string): Promise<YoutubeAudioResult | null> => {
        console.log(`[YouTube Service] Resolving full song for: ${title} - ${artist}`);

        const videoId = await YoutubeService.searchTrack(title, artist);
        if (!videoId) return null;

        const url = await YoutubeService.resolveAudioUrl(videoId);
        if (!url) return null;

        return { url, videoId };
    }
};
