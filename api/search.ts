import ytSearch from 'youtube-sr';

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

        const query = `${title} ${artist} audio`;
        const yt = (ytSearch as unknown as { default: typeof ytSearch }).default || ytSearch;

        try {
            const searchResult = await yt.search(query, { limit: 1, type: "video" });
            if (searchResult && searchResult.length > 0) {
                return res.status(200).json({ videoId: searchResult[0].id, source: 'youtube-sr' });
            }
        } catch (err) {
            console.warn(`[Serverless Search] youtube-sr failed: ${err}`);
        }

        return res.status(404).json({ error: 'No videos found on YouTube' });

    } catch (e) {
        console.error('[Serverless Search] Fatal Error:', e);
        return res.status(500).json({ error: String(e) });
    }
}
