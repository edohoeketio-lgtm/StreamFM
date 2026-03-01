import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { Gateway } from './pages/Gateway';
import { StreamerApp } from './pages/StreamerApp';
import { ListenerApp } from './pages/ListenerApp';

/* Intercept Spotify OAuth callback at any route and forward to /streamer */
function SpotifyRedirectGuard() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');

  if (code) {
    return <Navigate to={`/streamer?code=${code}`} replace />;
  }

  return <Gateway />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SpotifyRedirectGuard />} />
        <Route path="/streamer" element={<StreamerApp />} />
        <Route path="/listener" element={<ListenerApp />} />
        <Route path="*" element={<SpotifyRedirectGuard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
