/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#0b0b0f', // Deepest background
          900: '#0e0e12', // Page background
          850: '#13131a', // Card/Panel background
          800: '#1a1a22', // Secondary background
          700: '#252530', // Borders
          600: '#2f2f40', // Lighter borders / accents
        },
        trade: {
          green: '#34d399', // Win
          red: '#f87171',   // Loss
          blue: '#4f8ef7',  // Breakeven / Info
          gold: '#ffd600',  // Special alerts
        },
        blue: {
          400: '#7aabf9',
          500: '#4f8ef7',
          600: '#4f8ef7',
          900: '#1a2f60',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-subtle': 'pulseSubtle 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        }
      }
    },
  },
  plugins: [],
}
