export const config = {
    runtime: 'edge',
};

const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.tokyo.io',
    'https://piped-api.lunar.icu',
    'https://api.piped.li',
    'https://pipedapi.official-multimedia-group.de'
];

export default async function handler(request: Request) {
    // 1. Parse Query Params
    const url = new URL(request.url);
    const title = url.searchParams.get('title');
    const artist = url.searchParams.get('artist') || '';

    if (!title) {
        return new Response(JSON.stringify({ error: 'Missing title parameter' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    const query = encodeURIComponent(`${title} ${artist} topic`);

    // 2. Try each Piped Instance until one works (Bypasses Browser CORS)
    for (const baseUrl of PIPED_INSTANCES) {
        try {
            const searchUrl = `${baseUrl}/search?q=${query}&filter=videos`;
            const response = await fetch(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
                }
            });

            if (!response.ok) {
                console.warn(`[Proxy] ${baseUrl} returned ${response.status}`);
                continue;
            }

            const data = await response.json();
            const results = data.items || [];

            if (results.length > 0) {
                const videoUrl = results[0].url || '';
                const id = videoUrl.includes('v=') ? videoUrl.split('v=')[1] : (videoUrl.split('/').pop() || '');
                const videoId = id.split('&')[0];

                // Return Success Response
                return new Response(JSON.stringify({ videoId, source: baseUrl }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }
        } catch (e) {
            console.warn(`[Proxy] ${baseUrl} failed:`, e);
            // Continue to next instance
            continue;
        }
    }

    // 3. Fallback if all instances fail
    return new Response(JSON.stringify({ error: 'All YouTube search instances failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
}
