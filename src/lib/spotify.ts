import { SpotifyPlaylist } from '../types/radio';

/**
 * SPOTIFY SERVICE (PKCE OAUTH 2.0)
 * Uses Authorization Code Flow with Proof Key for Code Exchange (PKCE).
 */

// REGISTRATION REQUIRED: 
// 1. Create an app at https://developer.spotify.com/dashboard
// 2. Add 'http://localhost:5174/streamer' to Redirect URIs (update port if necessary)
// 3. Paste Client ID below:
const CLIENT_ID = 'f109553d49db42a6970785a579eda1d7';
export const hasSpotifyClientId = !!CLIENT_ID;
const REDIRECT_URI = window.location.origin + window.location.pathname;
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

const SCOPES = [
    'user-read-private',
    'playlist-read-private',
    'playlist-read-collaborative'
];

/**
 * Helper: Generate PKCE Code Verifier
 */
function generateCodeVerifier(length: number) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Helper: Generate PKCE Code Challenge
 */
async function generateCodeChallenge(codeVerifier: string) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

export const SpotifyService = {
    /**
     * Step 1: Redirect to Spotify for authorization
     */
    authorize: async () => {
        if (!CLIENT_ID) {
            alert('CRITICAL: SPOTIFY_CLIENT_ID is missing in src/lib/spotify.ts');
            return;
        }

        const verifier = generateCodeVerifier(128);
        const challenge = await generateCodeChallenge(verifier);

        localStorage.setItem('spotify_verifier', verifier);

        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            response_type: 'code',
            redirect_uri: REDIRECT_URI,
            scope: SCOPES.join(' '),
            code_challenge_method: 'S256',
            code_challenge: challenge,
        });

        window.location.href = `${AUTH_ENDPOINT}?${params.toString()}`;
    },

    /**
     * Step 2: Exchange the code for an access token
     */
    exchangeCode: async (code: string): Promise<{ token: string }> => {
        const verifier = localStorage.getItem('spotify_verifier');
        if (!verifier) throw new Error('Code verifier not found');

        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier,
        });

        const response = await fetch(TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error_description || 'Auth failed');

        return { token: data.access_token };
    },

    /**
     * Step 3: Fetch real playlists
     */
    fetchPlaylists: async (token: string): Promise<SpotifyPlaylist[]> => {
        try {
            const response = await fetchWithRetry('https://api.spotify.com/v1/me/playlists?limit=50', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            return data.items.map((p: { id: string; name: string; tracks: { total: number }; images: { url: string }[] }) => ({
                id: p.id,
                name: p.name,
                tracksCount: p.tracks.total,
                imageUrl: p.images?.[0]?.url || ''
            }));
        } catch (err) {
            console.error('Spotify Fetch Playlists Failed:', err);
            throw err;
        }
    },

    searchPlaylists: async (token: string, query: string): Promise<SpotifyPlaylist[]> => {
        try {
            const response = await fetchWithRetry(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=playlist&limit=20`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            return data.playlists.items.map((p: { id: string; name: string; tracks: { total: number }; images: { url: string }[] }) => ({
                id: p.id,
                name: p.name,
                tracksCount: p.tracks.total,
                imageUrl: p.images?.[0]?.url || ''
            }));
        } catch (err) {
            console.error('Spotify Search Failed:', err);
            return [];
        }
    }
};

/**
 * Helper: fetch with automatic retry on 429 (Rate Limit)
 * Implements recommended strategies from Spotify documentation.
 */
async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
    const response = await fetch(url, options);

    if (response.status === 429 && retries > 0) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '2');
        console.warn(`Spotify Rate Limit: Retrying after ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return fetchWithRetry(url, options, retries - 1);
    }

    if (!response.ok) {
        // Parse Spotify Regular Error Object
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error?.message || response.statusText;
        throw new Error(`Spotify API Error (${response.status}): ${message}`);
    }

    return response;
}

