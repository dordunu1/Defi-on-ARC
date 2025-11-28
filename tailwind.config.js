/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        dex: {
          bg: '#F9FAFB', // Light gray background
          card: '#FFFFFF', // White card
          text: '#111827', // Dark text
          textMuted: '#6B7280', // Gray text
          accent: '#EA580C', // Orange-600
          accentHover: '#C2410C', // Orange-700
          lightOrange: '#FFF7ED', // Orange-50
          border: '#E5E7EB', // Gray-200
        }
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'stream-slide': 'streamSlide 10s linear infinite',
        'stream-slide-reverse': 'streamSlideReverse 10s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        streamSlide: {
          '0%': { transform: 'translateX(-100%) translateY(-100%)' },
          '100%': { transform: 'translateX(100%) translateY(100%)' },
        },
        streamSlideReverse: {
          '0%': { transform: 'translateX(100%) translateY(100%)' },
          '100%': { transform: 'translateX(-100%) translateY(-100%)' },
        }
      }
    },
  },
  plugins: [],
};

