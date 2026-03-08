/**
 * DownloadService — Orchestrates track downloading.
 * 
 * Flow: YouTube Search (existing service) → Cobalt Audio Extraction → IndexedDB Storage
 */

import { AudioStore } from './audioStore';
import { YoutubeService } from './youtube';
import { Track } from '../types/radio';

// Cobalt instance URL — your Railway deployment
const COBALT_API_URL = 'https://cobalt-production-43b9.up.railway.app';

export type DownloadStatus = 'idle' | 'searching' | 'downloading' | 'done' | 'error';

export interface DownloadProgress {
    trackId: string;
    status: DownloadStatus;
    progress: number; // 0-100
    error?: string;
}

type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Download audio via Cobalt API.
 * Routes through /api/cobalt proxy on Vercel to avoid CORS,
 * falls back to direct call for local dev / if proxy unavailable.
 */
async function downloadViaCobalt(videoId: string, onProgress?: (pct: number) => void): Promise<Blob | null> {
    const cobaltUrl = localStorage.getItem('streamfm_cobalt_url') || COBALT_API_URL;
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Try the proxy first, then direct
    const endpoints = [
        '/api/cobalt',    // Vercel proxy (avoids CORS)
        `${cobaltUrl}/`,  // Direct (may work if Cobalt has CORS headers)
    ];

    for (const endpoint of endpoints) {
        try {
            console.log(`[Cobalt] Trying endpoint: ${endpoint}`);
            const response = await fetch(endpoint, {
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
                console.warn(`[Cobalt] ${endpoint} returned ${response.status}: ${errText}`);
                continue; // Try next endpoint
            }

            const data = await response.json();

            // Cobalt returns a download URL
            if (data.url) {
                console.log(`[Cobalt] Got download URL from ${endpoint}`);
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

                    return new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
                } else {
                    onProgress?.(50);
                    const blob = await audioResponse.blob();
                    onProgress?.(100);
                    return blob;
                }
            }

            // Some Cobalt versions return stream/redirect
            if (data.status === 'stream' || data.status === 'redirect') {
                const streamUrl = data.url || data.stream;
                const audioResponse = await fetch(streamUrl);
                return await audioResponse.blob();
            }

            console.warn(`[Cobalt] Unexpected response from ${endpoint}:`, data);
            continue;
        } catch (err) {
            console.warn(`[Cobalt] ${endpoint} failed:`, err);
            continue;
        }
    }

    throw new Error('All Cobalt endpoints failed. Check your Cobalt deployment.');
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

            // Step 1: Search YouTube using existing service
            notify('searching', 10);
            const videoId = await YoutubeService.searchTrack(track.title, track.artist);

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
