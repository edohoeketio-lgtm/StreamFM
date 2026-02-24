import { createContext } from 'react';
import { RadioState, RadioAction } from '../types/radio';

export const RadioContext = createContext<{
    state: RadioState;
    dispatch: React.Dispatch<RadioAction>;
} | undefined>(undefined);

export const AudioRefsContext = createContext<{
    audioContext: React.MutableRefObject<AudioContext | null>;
    analyser: React.MutableRefObject<AnalyserNode | null>;
    audioElement: React.MutableRefObject<HTMLAudioElement | null>;
    initAudio: () => void;
    togglePlay: () => void;
    stop: () => void;
} | undefined>(undefined);
