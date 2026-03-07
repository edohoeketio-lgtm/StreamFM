import { useRadio } from '../../hooks/useRadio';
import { motion } from 'framer-motion';
import { Zap } from '../ui/Icons';

export function Header() {
    const { state, dispatch } = useRadio();
    const { status, role } = state;

    const isPlaying = status === 'PLAYING';
    const isBuffering = status === 'BUFFERING';
    const isStreamer = role === 'streamer';

    const handleRoleToggle = () => {
        const newRole = isStreamer ? 'listener' : 'streamer';
        dispatch({ type: 'SET_ROLE', role: newRole });
        dispatch({ type: 'ADD_LOG', text: `Switched to ${newRole} mode` });
    };

    return (
        <header className="w-full flex items-center justify-between py-2 px-3 md:px-4 gap-2">
            {/* Logo - simplified on mobile */}
            <div className="flex items-center gap-2 shrink-0">
                <h1 className="text-base md:text-lg font-semibold tracking-tight text-primary whitespace-nowrap">XTC Radio</h1>
                <p className="text-[8px] uppercase tracking-wider text-secondary font-medium hidden md:block">Model 01 / Ref 294</p>
            </div>

            <div className="flex items-center gap-2 md:gap-3 shrink-0">
                {/* Wallet Balance - compact on mobile */}
                <button
                    onClick={() => dispatch({ type: 'TOGGLE_VAULT' })}
                    className="flex items-center gap-1.5 md:gap-3 px-2 md:px-4 py-1.5 md:py-2 rounded-full border border-amber-400/20 bg-amber-400/5 hover:bg-amber-400/10 hover:border-amber-400/40 transition-all group shadow-[0_0_15px_rgba(251,191,36,0.05)]"
                >
                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-amber-400 flex items-center justify-center text-black shadow-[0_0_10px_rgba(251,191,36,0.3)] shrink-0">
                        <Zap size={10} fill="currentColor" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[11px] md:text-[12px] font-black text-white tracking-widest uppercase">{state.wallet.total}</span>
                        <span className="text-[7px] md:text-[8px] font-bold text-amber-400/60 tracking-[0.2em] uppercase">HP</span>
                    </div>
                </button>

                {/* Role Toggle - hidden on small mobile */}
                <button
                    onClick={handleRoleToggle}
                    className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-card-border hover:border-accent/30 transition-all hardware-button text-[10px] font-bold tracking-widest uppercase"
                >
                    <span className={isStreamer ? 'text-primary' : 'text-secondary/50'}>DJ</span>
                    <div
                        className={`relative w-8 h-4 rounded-full transition-colors ${isStreamer ? 'bg-accent' : 'bg-gray-300'}`}
                    >
                        <div
                            className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${isStreamer ? 'translate-x-4' : 'translate-x-0'}`}
                        />
                    </div>
                    <span className={!isStreamer ? 'text-primary' : 'text-secondary/50'}>FM</span>
                </button>

                {/* Status Badge */}
                <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-card border border-card-border shadow-sm">
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
                    <span className={`text-[9px] md:text-[10px] font-bold tracking-widest ${isPlaying ? 'text-accent' : 'text-gray-400'}`}>
                        {isPlaying ? (isStreamer ? 'LIVE' : 'TUNED') : 'STBY'}
                    </span>
                </div>
            </div>
        </header>
    );
}
