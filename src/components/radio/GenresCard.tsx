import { useRadio } from '../../hooks/useRadio';
import { type Station, type ProgramMode } from '../../types/radio';
import { Card } from '../ui/Card';
import { motion } from 'framer-motion';
import { Zap } from '../ui/Icons';

// Group mappings
const STATION_GROUPS = {
    MOOD: ['feel-good-1', 'ambient-1', 'lofi-1'],
    RHYTHM: ['afro-1', 'techno-1', 'jazz-1'],
    FUTURE: ['synth-1']
};

function getEnergyLabel(mode: ProgramMode): string {
    switch (mode) {
        case 'After Hours':
        case 'Continuous Flow':
            return 'Low';
        case 'Pulse / Groove':
        case 'Experimental':
            return 'High';
        case 'Golden Hour':
            return 'Med';
        default:
            return 'Med';
    }
}

export function GenresCard() {
    const { state, dispatch } = useRadio();
    const { stations, activeStationId, programMode } = state;

    const handleSelect = (station: Station) => {
        if (station.id === activeStationId) return;

        const time = new Date().toLocaleTimeString();
        dispatch({ type: 'SWITCH_STATION', stationId: station.id });
        dispatch({
            type: 'ADD_LOG',
            text: `[${time}] Programming switched: ${station.name}`
        });

        // Ensure playback starts if it was stopped.
        // togglePlay from RadioContext handles resuming Context and initiating playback
        // But here we need access to togglePlay from AudioRefsContext
        // It's better to update the status and let the effect in RadioProvider handle the crossfade.
        // Wait, RadioProvider crossfade effect only runs if status === 'PLAYING'.
        // So we need to set status to PLAYING to trigger crossfade.
        dispatch({ type: 'SET_STATUS', status: 'PLAYING' });

        // Pick a random track
        const nextSegment = station.mockSegments[Math.floor(Math.random() * station.mockSegments.length)];
        dispatch({ type: 'UPDATE_NOW_PLAYING', text: nextSegment });
    };

    // Use Real Listener State
    const { listenerCounts } = state;

    const energy = getEnergyLabel(programMode);

    const renderGroup = (title: string, stationIds: string[]) => {
        const groupStations = stations.filter(s => stationIds.includes(s.id));
        if (groupStations.length === 0) return null;

        return (
            <div key={title} className="mb-4 last:mb-0">
                <h4 className="text-[10px] uppercase tracking-widest font-bold text-secondary mb-2 opacity-60 ml-1">{title}</h4>
                <div className="grid grid-cols-1 gap-2">
                    {groupStations.map(station => {
                        const isActive = station.id === activeStationId;
                        const count = listenerCounts[station.id] || 0;

                        return (
                            <motion.button
                                key={station.id}
                                onClick={() => handleSelect(station)}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                className={`
                                    relative flex items-center justify-between p-2 rounded-lg border transition-all group
                                    ${isActive
                                        ? 'bg-primary text-white border-primary shadow-md'
                                        : 'bg-white text-primary border-card-border hover:border-gray-300'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
                                    <div className="flex flex-col text-left">
                                        <span className="text-xs font-semibold leading-none mb-0.5">{station.name}</span>
                                        <span className={`text-[9px] ${isActive ? 'text-white/60' : 'text-primary/40'}`}>
                                            LIVE • {count.toLocaleString()} tuned in
                                        </span>
                                    </div>
                                </div>

                                <div className={`
                                    flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider
                                    ${isActive ? 'bg-white/10 text-white/90' : 'bg-gray-100 text-secondary'}
                                `}>
                                    <Zap size={8} fill="currentColor" />
                                    {energy}
                                </div>
                            </motion.button>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <Card title="Station Programming" className="col-span-12 md:col-span-3">
            <p className="text-xs text-primary/60 mb-4">Tuning changes global programming for all listeners.</p>
            <div className="overflow-y-auto max-h-[300px] pr-1 -mr-1 custom-scrollbar">
                {renderGroup('MOOD', STATION_GROUPS.MOOD)}
                {renderGroup('RHYTHM', STATION_GROUPS.RHYTHM)}
                {renderGroup('FUTURE', STATION_GROUPS.FUTURE)}
            </div>
        </Card>
    );
}
