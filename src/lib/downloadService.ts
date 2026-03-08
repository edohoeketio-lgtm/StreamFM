/**
 * DownloadService — Orchestrates track downloading.
 * 
 * Flow: YouTube Search → Cobalt Audio Extraction → IndexedDB Storage
 */

import { AudioStore } from './audioStore';
import { Track } from '../types/radio';

// Cobalt instance URL — your Railway deployment
const COBALT_API_URL = 'https://cobalt-production-43b9.up.railway.app';

// YouTube Data API Key
const YT_API_KEY = 'AIzaSyBzcFx8JnRDdN5w3oNKJTQmZDSUAw0gL4';

export type DownloadStatus = 'idle' | 'searching' | 'downloading' | 'done' | 'error';

export interface DownloadProgress {
    trackId: string;
    status: DownloadStatus;
    progress: number; // 0-100
    error?: string;
}

type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Search YouTube for the best matching video using official Data API.
 */
async function searchYouTube(title: string, artist: string, durationSec: number): Promise<string | null> {
    const query = `${title} ${artist} audio`;
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=5&key=${YT_API_KEY}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error('[YT Search] API error:', response.status);
            return null;
        }

        const data = await response.json();
        const items = data.items || [];

        if (items.length === 0) return null;

        // If we have duration info, verify the top results
        if (durationSec > 0 && items.length > 1) {
            const videoIds = items.map((item: { id: { videoId: string } }) => item.id.videoId).join(',');
            const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${YT_API_KEY}`;

            try {
                const detailsRes = await fetch(detailsUrl);
                const detailsData = await detailsRes.json();
                const videos = detailsData.items || [];

                // Find the video closest in duration
                let bestMatch = items[0].id.videoId;
                let bestDiff = Infinity;

                for (const video of videos) {
                    const iso = video.contentDetails.duration; // e.g. "PT3M45S"
                    const ytDuration = parseISO8601Duration(iso);
                    const diff = Math.abs(ytDuration - durationSec);

                    if (diff < bestDiff) {
                        bestDiff = diff;
                        bestMatch = video.id;
                    }
                }

                // Only use duration match if it's within 30 seconds
                if (bestDiff <= 30) {
                    return bestMatch;
                }
            } catch {
                // Fall through to first result
            }
        }

        return items[0].id.videoId;
    } catch (err) {
        console.error('[YT Search] Failed:', err);
        return null;
    }
}

/**
 * Parse ISO 8601 duration (e.g., "PT3M45S") to seconds.
 */
function parseISO8601Duration(iso: string): number {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Download audio via Cobalt API.
 */
async function downloadViaCobalt(videoId: string, onProgress?: (pct: number) => void): Promise<Blob | null> {
    const cobaltUrl = localStorage.getItem('streamfm_cobalt_url') || COBALT_API_URL;

    if (!cobaltUrl) {
        throw new Error('Cobalt URL not configured. Go to Settings → Set Cobalt URL.');
    }

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
        const response = await fetch(`${cobaltUrl}/`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: youtubeUrl,
                downloadMode: 'audio',
                audioFormat: 'mp3',
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Cobalt error (${response.status}): ${errText}`);
        }

        const data = await response.json();

        // Cobalt returns a download URL
        if (data.url) {
            const audioResponse = await fetch(data.url);
            if (!audioResponse.ok) throw new Error('Failed to download audio file');

            const contentLength = audioResponse.headers.get('content-length');
            const total = contentLength ? parseInt(contentLength) : 0;

            // Stream with progress tracking
            if (total > 0 && audioResponse.body) {
                const reader = audioResponse.body.getReader();
                const chunks: Uint8Array[] = [];
                let received = 0;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    received += value.length;
                    onProgress?.(Math.round((received / total) * 100));
                }

                const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
                return blob;
            } else {
                // No content-length, can't track progress
                onProgress?.(50);
                const blob = await audioResponse.blob();
                onProgress?.(100);
                return blob;
            }
        }

        // Some Cobalt versions return the audio directly in the response
        if (data.status === 'stream' || data.status === 'redirect') {
            const streamUrl = data.url || data.stream;
            const audioResponse = await fetch(streamUrl);
            return await audioResponse.blob();
        }

        throw new Error('Unexpected Cobalt response format');
    } catch (err) {
        console.error('[Cobalt] Download failed:', err);
        throw err;
    }
}

export const DownloadService = {
    /**
     * Download a single track: YouTube search → Cobalt → IndexedDB
     */
    downloadTrack: async (
        track: Track,
        onProgress?: ProgressCallback
    ): Promise<boolean> => {
        const notify = (status: DownloadStatus, progress: number, error?: string) => {
            onProgress?.({ trackId: track.id, status, progress, error });
        };

        try {
            // Check if already downloaded
            if (await AudioStore.has(track.id)) {
                notify('done', 100);
                return true;
            }

            // Step 1: Search YouTube
            notify('searching', 10);
            const videoId = await searchYouTube(track.title, track.artist, track.duration || 0);

            if (!videoId) {
                notify('error', 0, `No YouTube match found for "${track.title}"`);
                return false;
            }

            console.log(`[Download] Found YouTube match: ${videoId} for "${track.title}"`);

            // Step 2: Download audio via Cobalt
            notify('downloading', 20);
            const blob = await downloadViaCobalt(videoId, (pct) => {
                // Map cobalt progress (0-100) to our range (20-90)
                notify('downloading', 20 + Math.round(pct * 0.7));
            });

            if (!blob) {
                notify('error', 0, 'Audio extraction failed');
                return false;
            }

            // Step 3: Save to IndexedDB
            notify('downloading', 95);
            await AudioStore.save({ ...track, duration: track.duration || 0, bpm: track.bpm || 120 }, blob);

            notify('done', 100);
            console.log(`[Download] Saved "${track.title}" (${(blob.size / 1024 / 1024).toFixed(1)} MB)`);
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            notify('error', 0, message);
            return false;
        }
    },

    /**
     * Download multiple tracks sequentially.
     */
    downloadBatch: async (
        tracks: Track[],
        onProgress?: ProgressCallback
    ): Promise<{ success: number; failed: number }> => {
        let success = 0;
        let failed = 0;

        for (const track of tracks) {
            const result = await DownloadService.downloadTrack(track, onProgress);
            if (result) success++;
            else failed++;

            // Small delay between downloads to be polite
            await new Promise(r => setTimeout(r, 500));
        }

        return { success, failed };
    },

    /**
     * Get the playable URL for a downloaded track.
     * Returns the blob URL or null if not downloaded.
     */
    getPlayableURL: async (trackId: string): Promise<string | null> => {
        return AudioStore.createPlayableURL(trackId);
    },

    /**
     * Check which tracks from a list are already downloaded.
     */
    getDownloadedIds: async (): Promise<Set<string>> => {
        const ids = await AudioStore.getAllIds();
        return new Set(ids);
    },

    /**
     * Set the Cobalt instance URL.
     */
    setCobaltUrl: (url: string) => {
        // Normalize: remove trailing slash
        const normalized = url.replace(/\/+$/, '');
        localStorage.setItem('streamfm_cobalt_url', normalized);
    },

    /**
     * Get the current Cobalt URL.
     */
    getCobaltUrl: (): string => {
        return localStorage.getItem('streamfm_cobalt_url') || COBALT_API_URL;
    },

    /**
     * Get storage usage info.
     */
    getStorageInfo: async (): Promise<{ usedBytes: number; usedMB: string; trackCount: number }> => {
        const usedBytes = await AudioStore.getStorageUsed();
        const ids = await AudioStore.getAllIds();
        return {
            usedBytes,
            usedMB: (usedBytes / 1024 / 1024).toFixed(1),
            trackCount: ids.length,
        };
    },
};
