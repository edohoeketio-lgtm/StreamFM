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
     * Caller must revoke with URL.revokeObjectURL() when done.
     */
    createPlayableURL: async (trackId: string): Promise<string | null> => {
        const entry = await AudioStore.get(trackId);
        if (!entry) return null;
        return URL.createObjectURL(entry.blob);
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
