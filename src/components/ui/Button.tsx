import { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {

        // Base styles
        const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 disabled:pointer-events-none";

        // Variants
        const variants = {
            primary: "bg-primary text-white hover:bg-primary/90 shadow-md hover:shadow-lg active:scale-95",
            secondary: "bg-white border border-card-border text-primary hover:bg-gray-50 active:scale-95",
            ghost: "hover:bg-primary/5 text-primary active:scale-95",
            icon: "p-2 hover:bg-primary/5 text-primary rounded-full active:scale-90",
        };

        // Sizes
        const sizes = {
            sm: "h-8 px-3 text-xs",
            md: "h-10 px-4 py-2 text-sm",
            lg: "h-12 px-6 text-base",
            icon: "h-10 w-10",
        };

        return (
            <motion.button
                ref={ref}
                whileTap={{ scale: 0.98 }}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                {...props as any}
            >
                {isLoading ? (
                    <span className="animate-spin mr-2">⟳</span>
                ) : null}
                {children}
            </motion.button>
        );
    }
);

Button.displayName = "Button";
