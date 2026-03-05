import yt from 'youtube-sr';
yt.default.search("Secondhand (feat. Rema) Don Toliver audio", { limit: 1 })
    .then(x => console.log(x[0]?.id))
    .catch(console.error);
