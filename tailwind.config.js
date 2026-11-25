/** @type {import('tailwindcss').Config} */
const brand = {
  50: '#EEF4FF',
  100: '#DCE8FF',
  200: '#BCD3FF',
  300: '#8FB4FF',
  400: '#5C8EF5',
  500: '#2F6BE8',
  600: '#1F56D0',
  700: '#1844A8',
  800: '#153A86',
  900: '#102B62',
}

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      colors: {
        brand,
        // Any leftover "indigo" class automatically becomes the brand blue.
        indigo: brand,
        canvas: '#F3F6FB',
        ink: '#0F172A',
      },
      boxShadow: {
        // Dark, hard-edged drop shadow + soft depth: gives every module clear elevation.
        elev: '0 4px 0 0 #0F172A, 0 12px 22px -10px rgba(2,6,23,0.5)',
        'elev-sm': '0 3px 0 0 #0F172A, 0 8px 14px -8px rgba(2,6,23,0.45)',
        'elev-press': '0 1px 0 0 #0F172A',
        'elev-green': '0 3px 0 0 #14532D, 0 8px 14px -8px rgba(2,6,23,0.4)',
        'elev-red': '0 3px 0 0 #7F1D1D, 0 8px 14px -8px rgba(2,6,23,0.45)',
        'elev-amber': '0 3px 0 0 #78350F, 0 8px 14px -8px rgba(2,6,23,0.4)',
        'elev-blue': '0 3px 0 0 #102B62, 0 8px 14px -8px rgba(2,6,23,0.45)',
      },
      keyframes: {
        'sheet-up': {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'toast-in': {
          '0%': { transform: 'translateY(-12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'live-pulse': {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.45', transform: 'scale(1.35)' },
        },
      },
      animation: {
        'sheet-up': 'sheet-up .22s ease-out',
        'fade-in': 'fade-in .18s ease-out',
        'toast-in': 'toast-in .22s ease-out',
        'live-pulse': 'live-pulse 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
