import type { VercelRequest, VercelResponse } from '@vercel/node';

const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.tokyo.io',
    'https://piped-api.lunar.icu',
    'https://api.piped.li',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { title, artist } = req.query;
    if (!title || !artist) {
        return res.status(400).json({ error: 'Missing title or artist' });
    }

    const query = encodeURIComponent(`${title} ${artist} topic`);

    for (const instance of PIPED_INSTANCES) {
        try {
            const response = await fetch(`${instance}/search?q=${query}&filter=videos`);
            if (!response.ok) continue;

            const data = await response.json();
            const results = data.items || [];

            if (results.length > 0) {
                const url = results[0].url || '';
                const videoId = url.includes('v=')
                    ? url.split('v=')[1]?.split('&')[0]
                    : url.split('/').pop()?.split('&')[0];

                return res.status(200).json({
                    videoId: videoId || null,
                    source: instance,
                });
            }
        } catch {
            continue;
        }
    }

    return res.status(404).json({ videoId: null, error: 'No results found' });
}
