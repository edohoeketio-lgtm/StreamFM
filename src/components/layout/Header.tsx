import { useRadio } from '../../hooks/useRadio';
import { motion } from 'framer-motion';

export function Header() {
    const { state } = useRadio();
    const { status } = state;

    const isPlaying = status === 'PLAYING';
    const isBuffering = status === 'BUFFERING';

    return (
        <header className="w-full flex items-center justify-between py-2 px-1">
            <div className="flex flex-col">
                <h1 className="text-lg font-semibold tracking-tight text-primary">AI Radio Station</h1>
                <p className="text-[10px] uppercase tracking-wider text-secondary font-medium">Model 01 / Ref 294</p>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-card-border shadow-sm">
                    <div className="relative flex h-2 w-2">
                        {isPlaying && (
                            <motion.span
                                animate={{ opacity: [1, 0.5, 1] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-50"
                            >
                            </motion.span>
                        )}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isPlaying ? 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.4)]' :
                            isBuffering ? 'bg-amber-400' :
                                'bg-gray-300'
                            }`}></span>
                    </div>
                    <span className={`text-[10px] font-bold tracking-widest ${isPlaying ? 'text-primary' : 'text-gray-400'}`}>
                        {isPlaying ? 'REC' : 'STANDBY'}
                    </span>
                </div>
            </div>
        </header>
    );
}
