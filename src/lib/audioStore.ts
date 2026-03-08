/**
 * AudioStore — IndexedDB-backed persistent audio storage.
 * Stores downloaded MP3 blobs so tracks survive page refreshes.
 */

const DB_NAME = 'streamfm-audio';
const DB_VERSION = 1;
const STORE_NAME = 'tracks';

interface StoredTrack {
    id: string;           // Track ID (matches Track.id)
    blob: Blob;           // The actual audio data
    title: string;
    artist: string;
    duration: number;
    bpm: number;
    downloadedAt: number; // Timestamp
    sizeBytes: number;
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export const AudioStore = {
    /**
     * Save a downloaded audio blob for a track.
     */
    save: async (track: { id: string; title: string; artist: string; duration: number; bpm: number }, blob: Blob): Promise<void> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            const entry: StoredTrack = {
                id: track.id,
                blob,
                title: track.title,
                artist: track.artist,
                duration: track.duration,
                bpm: track.bpm,
                downloadedAt: Date.now(),
                sizeBytes: blob.size,
            };

            const request = store.put(entry);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get a stored track's audio blob. Returns null if not downloaded.
     */
    get: async (trackId: string): Promise<StoredTrack | null> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(trackId);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Check if a track has been downloaded.
     */
    has: async (trackId: string): Promise<boolean> => {
        const entry = await AudioStore.get(trackId);
        return entry !== null;
    },

    /**
     * Create a playable blob URL for a stored track.
     * Validates the blob before returning — auto-deletes corrupted entries.
     */
    createPlayableURL: async (trackId: string): Promise<string | null> => {
        const entry = await AudioStore.get(trackId);
        if (!entry) return null;

        // Validate: real MP3s are at least 100KB
        if (entry.blob.size < 100 * 1024) {
            console.warn(`[AudioStore] Corrupted entry "${entry.title}" (${entry.blob.size} bytes) — removing`);
            await AudioStore.delete(trackId);
            return null;
        }

        return URL.createObjectURL(entry.blob);
    },

    /**
     * Validate all stored entries and remove corrupted ones.
     * Call this on app startup.
     */
    validateAndClean: async (): Promise<number> => {
        try {
            const db = await openDB();
            const entries = await new Promise<StoredTrack[]>((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result as StoredTrack[]);
                request.onerror = () => reject(request.error);
            });

            let removed = 0;
            for (const entry of entries) {
                // Remove entries under 100KB (not real audio)
                if (entry.blob.size < 100 * 1024) {
                    console.warn(`[AudioStore] Purging corrupted: "${entry.title}" (${entry.blob.size} bytes)`);
                    await AudioStore.delete(entry.id);
                    removed++;
                }
            }

            if (removed > 0) {
                console.log(`[AudioStore] Cleaned up ${removed} corrupted entries`);
            }
            return removed;
        } catch {
            return 0;
        }
    },

    /**
     * Delete a downloaded track.
     */
    delete: async (trackId: string): Promise<void> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(trackId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get all downloaded track IDs (for quick status checks).
     */
    getAllIds: async (): Promise<string[]> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAllKeys();

            request.onsuccess = () => resolve(request.result as string[]);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Clear all downloads.
     */
    clearAll: async (): Promise<void> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get total storage used by downloads (in bytes).
     */
    getStorageUsed: async (): Promise<number> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const entries = request.result as StoredTrack[];
                const total = entries.reduce((sum, e) => sum + e.sizeBytes, 0);
                resolve(total);
            };
            request.onerror = () => reject(request.error);
        });
    },
};
