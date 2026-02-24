import { type ReactNode } from 'react';

export function Shell({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-background text-primary selection:bg-accent/20 p-4 md:p-8 font-sans">
            <div className="max-w-[1600px] mx-auto space-y-6">
                {children}
            </div>
        </div>
    );
}
