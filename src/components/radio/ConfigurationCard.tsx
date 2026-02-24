import { useState, useEffect } from 'react';
import { useRadio } from '../../hooks/useRadio';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ArrowRight } from '../ui/Icons';

export function ConfigurationCard() {
    const { state, dispatch } = useRadio();
    const [selectedId, setSelectedId] = useState(state.activeStationId);

    // Sync local selection when global active station changes 
    useEffect(() => {
        setSelectedId(state.activeStationId);
    }, [state.activeStationId]);

    const handleUpdate = () => {
        const targetStation = state.stations.find(s => s.id === selectedId);
        if (!targetStation) return;

        dispatch({ type: 'SWITCH_STATION', stationId: selectedId });
        dispatch({ type: 'ADD_LOG', text: `Tuned into: ${targetStation.name}. Connecting stream...` });

        // Provide a realistic connect delay
        dispatch({ type: 'SET_STATUS', status: 'BUFFERING' });
        setTimeout(() => {
            dispatch({ type: 'SET_STATUS', status: 'PLAYING' });
            dispatch({ type: 'ADD_LOG', text: 'Stream connected successfully.' });
        }, 1500);
    };

    return (
        <Card title="Station Selector" className="col-span-12 lg:col-span-4 flex flex-col gap-4">
            <div className="space-y-4 flex-1">
                <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-secondary tracking-widest flex items-center gap-2">
                        Available Frequencies
                    </label>
                    <div className="flex flex-col gap-2 mt-2">
                        {state.stations.slice(0, 3).map((station) => (
                            <button
                                key={station.id}
                                onClick={() => setSelectedId(station.id)}
                                className={`flex flex-col items-start w-full rounded-lg border px-4 py-3 text-left transition-all ${selectedId === station.id
                                    ? 'border-brand bg-brand/5 shadow-sm'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                <span className={`text-sm font-medium ${selectedId === station.id ? 'text-brand' : 'text-primary'}`}>
                                    {station.name}
                                </span>
                                <span className="text-xs text-gray-500 truncate w-full">
                                    {station.description}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <Button onClick={handleUpdate} className="w-full mt-auto h-12 hardware-button group text-primary font-medium tracking-wide">
                <span className="mr-2">TUNE IN</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 opacity-50" />
            </Button>
        </Card>
    );
}
