import ytSearch from 'yt-search';

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
        const searchResult = await ytSearch(query);

        if (searchResult.videos && searchResult.videos.length > 0) {
            // Pick the best match (yt-search handles relevance sorting pretty well)
            const videoId = searchResult.videos[0].videoId;
            return res.status(200).json({ videoId, source: 'yt-search' });
        }

        return res.status(404).json({ error: 'No videos found on YouTube' });

    } catch (e) {
        console.error('[Serverless Search] Failed:', e);
        return res.status(500).json({ error: String(e) });
    }
}
