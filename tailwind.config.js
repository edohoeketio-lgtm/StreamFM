/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#f4f4f4",
                primary: "#0b0b0b",
                secondary: "#6b6b6b",
                accent: "#0b0b0b",
                card: "#ffffff",
                "card-border": "#d8d8d8",
            },
            fontFamily: {
                sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
                mono: ['"SF Mono"', '"Menlo"', '"Monaco"', '"Courier New"', 'monospace'],
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }
        },
    },
    plugins: [],
}
