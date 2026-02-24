import { useContext } from 'react';
import { RadioContext, AudioRefsContext } from '../context/RadioContexts';

export function useRadio() {
    const context = useContext(RadioContext);
    if (!context) throw new Error('useRadio must be used within RadioProvider');
    return context;
}

export function useAudioEngine() {
    const context = useContext(AudioRefsContext);
    if (!context) throw new Error('useAudioEngine must be used within RadioProvider');
    return context;
}
