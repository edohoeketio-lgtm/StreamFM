import { Link } from 'react-router-dom';
import { Radio, Headphones } from 'lucide-react';
import { motion } from 'framer-motion';

export function Gateway() {
    return (
        <div className="min-h-screen bg-black text-white font-sans flex flex-col items-center justify-center p-6 selection:bg-white/20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-2xl text-center space-y-12"
            >
                <div className="space-y-4">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-white">
                        Choose your frequency.
                    </h1>
                    <p className="text-white/50 text-lg tracking-tight">
                        Are you transmitting to the world, or tuning in?
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg mx-auto">
                    {/* Streamer Mode */}
                    <Link to="/streamer" className="group relative block w-full aspect-square bg-[#111113] border border-white/10 rounded-[32px] overflow-hidden hover:border-white/30 transition-colors p-8 flex flex-col items-center justify-center text-center">
                        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 text-white group-hover:scale-110 group-hover:bg-white/10 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
                            <Radio size={28} />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Broadcaster</h2>
                        <p className="text-sm text-white/50 font-medium tracking-tight">Access the studio.</p>
                    </Link>

                    {/* Listener Mode (Disabled) */}
                    <button disabled className="group relative block w-full aspect-square bg-[#111113]/50 border border-white/5 rounded-[32px] overflow-hidden p-8 flex flex-col items-center justify-center text-center opacity-50 cursor-not-allowed">
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 text-white/50">
                            <Headphones size={28} />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-white/50 mb-2">Listener <span className="text-xs ml-1 font-normal tracking-normal text-white/30">(Coming Soon)</span></h2>
                        <p className="text-sm text-white/30 font-medium tracking-tight">Since we haven't built it yet.</p>
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
