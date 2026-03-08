import type { VercelRequest, VercelResponse } from '@vercel/node';

const COBALT_URL = 'https://cobalt-production-43b9.up.railway.app';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { url, downloadMode, audioFormat } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'Missing url parameter' });
        }

        const cobaltRes = await fetch(`${COBALT_URL}/`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url,
                downloadMode: downloadMode || 'audio',
                audioFormat: audioFormat || 'mp3',
            }),
        });

        const data = await cobaltRes.json();

        if (!cobaltRes.ok) {
            return res.status(cobaltRes.status).json(data);
        }

        return res.status(200).json(data);
    } catch (err) {
        console.error('[Cobalt Proxy] Error:', err);
        return res.status(500).json({ error: 'Cobalt proxy failed' });
    }
}
