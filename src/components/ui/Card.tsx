import { cn } from '../../lib/utils';
import { motion, type HTMLMotionProps } from 'framer-motion';

interface CardProps extends HTMLMotionProps<"div"> {
    title?: string;
    children: React.ReactNode;
}

export function Card({ className, title, children, ...props }: CardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={cn(
                "rounded-xl bg-white border border-card-border shadow-sm p-6 relative overflow-hidden",
                "backdrop-blur-sm bg-opacity-80",
                className
            )}
            {...props}
        >
            {title && (
                <div className="mb-4">
                    <h3 className="text-sm uppercase tracking-widest text-primary/60 font-semibold">{title}</h3>
                </div>
            )}
            {children}
        </motion.div>
    );
}
