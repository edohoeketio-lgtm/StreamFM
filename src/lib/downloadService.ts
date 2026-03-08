/**
 * DownloadService — Orchestrates track downloading.
 * 
 * Flow: YouTube Search (existing service) → Cobalt Audio Extraction (via proxy) → IndexedDB Storage
 */

import { AudioStore } from './audioStore';
import { YoutubeService } from './youtube';
import { Track } from '../types/radio';

export type DownloadStatus = 'idle' | 'searching' | 'downloading' | 'done' | 'error';

export interface DownloadProgress {
    trackId: string;
    status: DownloadStatus;
    progress: number; // 0-100
    error?: string;
}

type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Download audio via the /api/cobalt proxy.
 * The proxy handles all Cobalt communication server-side and returns raw MP3 data.
 */
async function downloadViaCobalt(videoId: string, onProgress?: (pct: number) => void): Promise<Blob | null> {
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

    console.log(`[Download] Requesting audio via /api/cobalt for ${videoId}...`);
    onProgress?.(10);

    const response = await fetch('/api/cobalt', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            url: youtubeUrl,
            downloadMode: 'audio',
            audioFormat: 'mp3',
        }),
    });

    if (!response.ok) {
        let errorDetail = `HTTP ${response.status}`;
        try {
            const errData = await response.json();
            errorDetail = errData.error || errorDetail;
        } catch {
            // response wasn't JSON
        }
        throw new Error(`Cobalt proxy error: ${errorDetail}`);
    }

    const contentType = response.headers.get('content-type') || '';
    console.log(`[Download] Response content-type: ${contentType}`);

    // If proxy returned JSON, it's an error or it returned a URL (old behavior)
    if (contentType.includes('application/json')) {
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        // Shouldn't happen with new proxy, but handle gracefully
        throw new Error('Proxy returned JSON instead of audio');
    }

    // Proxy returns raw audio data — read it as a blob
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength) : 0;

    if (total > 0 && response.body) {
        const reader = response.body.getReader();
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
        console.log(`[Download] Received ${(blob.size / 1024 / 1024).toFixed(1)} MB of audio data`);

        // Sanity check: MP3 should be at least 100KB
        if (blob.size < 100 * 1024) {
            console.warn(`[Download] Suspiciously small audio file: ${blob.size} bytes`);
        }

        return blob;
    } else {
        // No content-length, can't track progress
        onProgress?.(50);
        const blob = await response.blob();
        onProgress?.(100);
        console.log(`[Download] Received ${(blob.size / 1024 / 1024).toFixed(1)} MB of audio data`);
        return blob;
    }
}

export const DownloadService = {
    /**
     * Download a single track: YouTube search → Cobalt proxy → IndexedDB
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

            // Step 1: Search YouTube using existing service
            notify('searching', 10);
            const videoId = await YoutubeService.searchTrack(track.title, track.artist);

            if (!videoId) {
                notify('error', 0, `No YouTube match found for "${track.title}"`);
                return false;
            }

            console.log(`[Download] Found YouTube match: ${videoId} for "${track.title}"`);

            // Step 2: Download audio via Cobalt proxy
            notify('downloading', 20);
            const blob = await downloadViaCobalt(videoId, (pct) => {
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
            console.log(`[Download] ✅ Saved "${track.title}" (${(blob.size / 1024 / 1024).toFixed(1)} MB)`);
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.error(`[Download] ❌ Failed "${track.title}":`, message);
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
            await new Promise(r => setTimeout(r, 500));
        }

        return { success, failed };
    },

    /**
     * Get the playable URL for a downloaded track.
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
        const normalized = url.replace(/\/+$/, '');
        localStorage.setItem('streamfm_cobalt_url', normalized);
    },

    /**
     * Get the current Cobalt URL.
     */
    getCobaltUrl: (): string => {
        return localStorage.getItem('streamfm_cobalt_url') || 'https://cobalt-production-43b9.up.railway.app';
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
