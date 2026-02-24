import { useRadio } from '../../hooks/useRadio';
import { type ProgramMode } from '../../types/radio';
import { Card } from '../ui/Card';
import { motion } from 'framer-motion';

const MODES: ProgramMode[] = [
    'Continuous Flow',
    'Pulse / Groove',
    'Golden Hour',
    'After Hours',
    'Experimental'
];

export function ScaleModelCard() {
    const { state, dispatch } = useRadio();
    const { programMode } = state;

    const handleModeChange = (mode: ProgramMode) => {
        dispatch({ type: 'SET_PROGRAM_MODE', mode });
        const time = new Date().toLocaleTimeString();
        dispatch({
            type: 'ADD_LOG',
            text: `[${time}] Program mode set: ${mode}`
        });
    };

    return (
        <Card title="Program Mode" className="col-span-12 md:col-span-3">
            <p className="text-xs text-primary/60 mb-3">Controls how the station evolves over time.</p>

            <div className="flex flex-col gap-1.5">
                {MODES.map(mode => {
                    const isActive = programMode === mode;
                    return (
                        <motion.button
                            key={mode}
                            onClick={() => handleModeChange(mode)}
                            whileTap={{ scale: 0.98 }}
                            className={`
                                relative w-full text-left px-3 py-2 rounded-lg text-xs font-medium border transition-all
                                ${isActive
                                    ? 'bg-primary text-white border-primary shadow-sm'
                                    : 'bg-white text-primary/80 border-card-border hover:bg-gray-50'
                                }
                            `}
                        >
                            <div className="flex items-center justify-between">
                                <span>{mode}</span>
                                {isActive && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
                                )}
                            </div>
                        </motion.button>
                    );
                })}
            </div>
            <div className="p-3 bg-primary/5 rounded border border-primary/5 mt-4">
                <p className="text-xs text-primary/60">
                    <strong className="block text-primary/80 mb-1">Current Model</strong>
                    Lyria-Realtime-v2.1
                </p>
            </div>
        </Card>
    );
}
