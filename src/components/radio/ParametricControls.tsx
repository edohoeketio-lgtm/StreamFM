import { useRadio } from '../../hooks/useRadio';
import { Card } from '../ui/Card';
import { Volume2, Sun, Zap } from '../ui/Icons';

export function ParametricControls() {
    const { state, dispatch } = useRadio();
    const { bpm, density, brightness, mixOptions } = state;

    const handleMixToggle = (option: keyof typeof mixOptions) => {
        dispatch({ type: 'TOGGLE_MIX_OPTION', option });
        dispatch({ type: 'ADD_LOG', text: `Toggled mix option: ${String(option)}` });
    };

    return (
        <Card title="Signal Controls" className="col-span-12 md:col-span-6 flex flex-col justify-between h-[300px]">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">

                {/* Sliders Section */}
                <div className="flex flex-col justify-center space-y-6">
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs font-medium text-secondary tracking-wider uppercase">
                            <span className="flex items-center gap-2"><Zap size={12} /> Speed</span>
                            <span className="font-mono">{bpm}</span>
                        </div>
                        <input
                            type="range"
                            min="60"
                            max="180"
                            value={bpm}
                            onChange={(e) => dispatch({ type: 'UPDATE_PARAMS', payload: { bpm: Number(e.target.value) } })}
                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs font-medium text-secondary tracking-wider uppercase">
                            <span className="flex items-center gap-2"><Volume2 size={12} /> Density</span>
                            <span className="font-mono">{(density * 100).toFixed(0)}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={density}
                            onChange={(e) => dispatch({ type: 'UPDATE_PARAMS', payload: { density: Number(e.target.value) } })}
                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs font-medium text-secondary tracking-wider uppercase">
                            <span className="flex items-center gap-2"><Sun size={12} /> Brightness</span>
                            <span className="font-mono">{(brightness * 100).toFixed(0)}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={brightness}
                            onChange={(e) => dispatch({ type: 'UPDATE_PARAMS', payload: { brightness: Number(e.target.value) } })}
                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>
                </div>

                {/* Mix Options Section */}
                <div className="h-full border-l border-card-border/50 pl-0 md:pl-8 flex flex-col justify-center">
                    <h4 className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-4">Mix Isolation</h4>

                    <div className="space-y-3">
                        <label className="flex items-center justify-between cursor-pointer group p-2 hover:bg-gray-50 rounded transition-colors -mx-2">
                            <span className="text-xs font-medium text-primary">Mute Bass</span>
                            <div className={`relative w-8 h-4 rounded-full transition-colors ${mixOptions.muteBass ? 'bg-primary' : 'bg-gray-300'}`}>
                                <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${mixOptions.muteBass ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                            <input type="checkbox" className="hidden" checked={mixOptions.muteBass} onChange={() => handleMixToggle('muteBass')} />
                        </label>

                        <label className="flex items-center justify-between cursor-pointer group p-2 hover:bg-gray-50 rounded transition-colors -mx-2">
                            <span className="text-xs font-medium text-primary">Mute Drums</span>
                            <div className={`relative w-8 h-4 rounded-full transition-colors ${mixOptions.muteDrums ? 'bg-primary' : 'bg-gray-300'}`}>
                                <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${mixOptions.muteDrums ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                            <input type="checkbox" className="hidden" checked={mixOptions.muteDrums} onChange={() => handleMixToggle('muteDrums')} />
                        </label>

                        <label className="flex items-center justify-between cursor-pointer group p-2 hover:bg-gray-50 rounded transition-colors -mx-2">
                            <span className="text-xs font-medium text-primary">Focus Mode</span>
                            <div className={`relative w-8 h-4 rounded-full transition-colors ${mixOptions.onlyBassDrums ? 'bg-primary' : 'bg-gray-300'}`}>
                                <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${mixOptions.onlyBassDrums ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                            <input type="checkbox" className="hidden" checked={mixOptions.onlyBassDrums} onChange={() => handleMixToggle('onlyBassDrums')} />
                        </label>
                    </div>
                </div>

            </div>
        </Card>
    );
}
