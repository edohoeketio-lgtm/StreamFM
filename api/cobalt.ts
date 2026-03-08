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

        console.log(`[Cobalt Proxy] Requesting audio for: ${url}`);

        // Step 1: Ask Cobalt for the download/tunnel URL
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

        if (!cobaltRes.ok) {
            const errText = await cobaltRes.text();
            console.error(`[Cobalt Proxy] Cobalt returned ${cobaltRes.status}: ${errText}`);
            return res.status(cobaltRes.status).json({ error: errText });
        }

        const cobaltData = await cobaltRes.json();
        console.log(`[Cobalt Proxy] Cobalt response status: ${cobaltData.status}, has url: ${!!cobaltData.url}`);

        const downloadUrl = cobaltData.url;
        if (!downloadUrl) {
            return res.status(500).json({ error: 'Cobalt returned no download URL', cobaltData });
        }

        // Step 2: Download the actual audio SERVER-SIDE (avoids CORS issues)
        console.log(`[Cobalt Proxy] Downloading audio from: ${downloadUrl.substring(0, 80)}...`);
        const audioRes = await fetch(downloadUrl);

        if (!audioRes.ok) {
            console.error(`[Cobalt Proxy] Audio download failed: ${audioRes.status}`);
            return res.status(502).json({ error: `Audio download failed: ${audioRes.status}` });
        }

        const contentType = audioRes.headers.get('content-type') || 'audio/mpeg';
        const contentLength = audioRes.headers.get('content-length');

        console.log(`[Cobalt Proxy] Audio response: type=${contentType}, size=${contentLength}`);

        // Verify it's actually audio
        if (!contentType.includes('audio') && !contentType.includes('octet-stream') && !contentType.includes('mpeg')) {
            console.error(`[Cobalt Proxy] Unexpected content type: ${contentType}`);
            const body = await audioRes.text();
            return res.status(502).json({
                error: `Expected audio, got ${contentType}`,
                preview: body.substring(0, 200)
            });
        }

        // Step 3: Stream the audio back to the client
        const audioBuffer = await audioRes.arrayBuffer();

        res.setHeader('Content-Type', 'audio/mpeg');
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }

        return res.status(200).send(Buffer.from(audioBuffer));
    } catch (err) {
        console.error('[Cobalt Proxy] Error:', err);
        return res.status(500).json({ error: 'Cobalt proxy failed', message: String(err) });
    }
}
