import ytSearch from 'yt-search';
ytSearch("The Bass Starsamm").then(res => console.log(res.videos[0]?.videoId)).catch(console.error);
