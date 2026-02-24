import { RadioProvider } from './context/RadioProvider';
import { Shell } from './components/layout/Shell';
import { Header } from './components/layout/Header';
import { Visualizer } from './components/radio/Visualizer';
import { ConfigurationCard } from './components/radio/ConfigurationCard';
import { ParametricControls } from './components/radio/ParametricControls';
import { ScaleModelCard } from './components/radio/ScaleModelCard';
import { GenresCard } from './components/radio/GenresCard';
import { DebugLog } from './components/radio/DebugLog';

function App() {
  return (
    <RadioProvider>
      <Shell>
        <Header />

        {/* Bento Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Row 1 */}
          <Visualizer />
          <ConfigurationCard />

          {/* Row 2 */}
          <ParametricControls />
          <ScaleModelCard />
          <GenresCard />

          {/* Row 3 - Debug Log */}
          <DebugLog />
        </div>
      </Shell>
    </RadioProvider>
  );
}

export default App;
