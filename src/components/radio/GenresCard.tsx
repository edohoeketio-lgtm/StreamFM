import { useRadio } from '../../hooks/useRadio';
import { Card } from '../ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback } from 'react';


/* ─── Streamer: Soundboard Card ─── */
function SoundboardCard() {
    const { dispatch } = useRadio();
    const [activeEffects, setActiveEffects] = useState<Record<string, boolean>>({});

    const EFFECTS = [
        { id: 'airhorn', label: '📢 Airhorn' },
        { id: 'rewind', label: '⏪ Rewind' },
        { id: 'drop', label: '💥 Bass Drop' },
        { id: 'hype', label: '🎤 Hype' },
        { id: 'vinyl', label: '💿 Vinyl Scratch' },
        { id: 'custom', label: '✦ Custom Drop' },
    ];

    const triggerEffect = useCallback((fx: typeof EFFECTS[number]) => {
        setActiveEffects(prev => ({ ...prev, [fx.id]: true }));
        dispatch({ type: 'ADD_LOG', text: `🔊 Triggered: ${fx.label}` });
        setTimeout(() => {
            setActiveEffects(prev => ({ ...prev, [fx.id]: false }));
        }, 300);
    }, [dispatch]);

    return (
        <>
            <p className="text-xs text-primary/60 mb-4">Tap to trigger live sound effects to your audience.</p>
            <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[300px]">
                {EFFECTS.map(fx => (
                    <motion.button
                        key={fx.id}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => triggerEffect(fx)}
                        className={`p-3 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all hardware-button ${activeEffects[fx.id]
                            ? 'bg-accent text-white border-accent shadow-inner'
                            : 'text-primary hover:bg-accent/5'
                            }`}
                    >
                        {fx.label}
                    </motion.button>
                ))}
            </div>
        </>
    );
}

/* ─── Listener: Tip Card ─── */
function TipCard() {
    const { dispatch } = useRadio();
    const [tokenBalance, setTokenBalance] = useState(25);
    const [activeTips, setActiveTips] = useState<Record<string, boolean>>({});

    const TIPS = [
        { id: 'vinyl', label: '💿 Vinyl', cost: 1 },
        { id: 'spark', label: '✨ Spark', cost: 2 },
        { id: 'fire', label: '🔥 Fire', cost: 5 },
        { id: 'diamond', label: '💎 Diamond', cost: 10 },
    ];

    const sendTip = useCallback((tip: typeof TIPS[number]) => {
        if (tokenBalance < tip.cost) {
            dispatch({ type: 'ADD_LOG', text: `Not enough tokens for ${tip.label}` });
            return;
        }
        setTokenBalance(prev => prev - tip.cost);
        setActiveTips(prev => ({ ...prev, [tip.id]: true }));
        dispatch({ type: 'ADD_LOG', text: `🎁 Sent ${tip.label} (${tip.cost} tokens)` });
        setTimeout(() => {
            setActiveTips(prev => ({ ...prev, [tip.id]: false }));
        }, 500);
    }, [dispatch, tokenBalance]);

    return (
        <>
            {/* Token Balance */}
            <div className="flex items-center justify-between mb-4 p-3 rounded-lg hardware-inset">
                <span className="text-[10px] uppercase tracking-widest font-bold text-secondary">Token Balance</span>
                <span className="text-lg font-mono font-semibold text-primary tabular-nums">{tokenBalance}</span>
            </div>

            <p className="text-xs text-primary/60 mb-3">Send a gift to the streamer. Each gift triggers a live animation.</p>

            <div className="grid grid-cols-2 gap-2">
                {TIPS.map(tip => (
                    <motion.button
                        key={tip.id}
                        whileTap={{ scale: 0.93 }}
                        onClick={() => sendTip(tip)}
                        className={`p-3 rounded-lg border text-xs font-bold transition-all hardware-button flex flex-col items-center gap-1 ${activeTips[tip.id]
                            ? 'bg-accent text-white border-accent shadow-inner'
                            : tokenBalance < tip.cost
                                ? 'text-secondary/30 pointer-events-none opacity-50'
                                : 'text-primary hover:bg-accent/5'
                            }`}
                    >
                        <span className="text-lg">{tip.label.split(' ')[0]}</span>
                        <span className="tracking-wider uppercase">{tip.label.split(' ')[1]}</span>
                        <span className="text-[9px] font-mono text-secondary/50 mt-0.5">{tip.cost} tokens</span>
                    </motion.button>
                ))}
            </div>

            <button
                onClick={() => {
                    setTokenBalance(prev => prev + 25);
                    dispatch({ type: 'ADD_LOG', text: '💰 Purchased 25 tokens' });
                }}
                className="w-full mt-3 p-2.5 rounded-lg hardware-button text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/5 transition-colors"
            >
                + Buy Tokens
            </button>
        </>
    );
}


/* ─── Main Export ─── */
export function GenresCard() {
    const { state } = useRadio();

    return (
        <Card
            title={state.role === 'streamer' ? 'Soundboard' : 'Tips & Tokens'}
            className="col-span-12 md:col-span-3"
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={state.role}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                >
                    {state.role === 'streamer' ? <SoundboardCard /> : <TipCard />}
                </motion.div>
            </AnimatePresence>
        </Card>
    );
}
