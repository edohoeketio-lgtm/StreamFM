// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const title = req.query.title;
        const artist = req.query.artist || '';

        if (!title) {
            return res.status(400).json({ error: 'Missing title parameter' });
        }

        const query = encodeURIComponent(`${title} ${artist} audio`);

        const PIPED_INSTANCES = [
            'https://pipedapi.kavin.rocks',
            'https://pipedapi.tokyo.io',
            'https://piped-api.lunar.icu',
            'https://api.piped.li',
            'https://pipedapi.official-multimedia-group.de'
        ];

        let videoId = null;

        for (const baseUrl of PIPED_INSTANCES) {
            try {
                const searchUrl = `${baseUrl}/search?q=${query}&filter=videos`;
                const response = await fetch(searchUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                });

                if (!response.ok) continue;

                const data = await response.json();
                const results = data.items || [];

                if (results.length > 0) {
                    const url = results[0].url || '';
                    const id = url.includes('v=') ? url.split('v=')[1] : (url.split('/').pop() || '');
                    videoId = id.split('&')[0];
                    break;
                }
            } catch {
                console.warn(`[Serverless Search] Failed on ${baseUrl}`);
                continue;
            }
        }

        if (videoId) {
            return res.status(200).json({ videoId, source: 'piped-api' });
        }

        return res.status(404).json({ error: 'No videos found across all instances' });

    } catch (e) {
        console.error('[Serverless Search] Fatal Error:', e);
        return res.status(500).json({ error: String(e) });
    }
}
