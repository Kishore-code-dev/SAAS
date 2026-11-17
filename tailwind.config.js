/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Noto Sans Tamil"', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '"Noto Sans Tamil"', 'system-ui', 'sans-serif'],
        mono: ['"Plus Jakarta Sans"', '"Noto Sans Tamil"', 'system-ui', 'sans-serif'],
      },
      colors: {
        'pure-white': '#FFFFFF',
        'pale-lavender': '#EEE8F7',
        'soft-lilac': '#E2D8F3',
        'golden-yellow': '#E8C65A',
        'royal-lavender': '#B8A3D9',
        'royal-lavender-ink': '#6E5696',
        cocoa: '#625346',
        'warm-grey': '#958777',
        'muted-cocoa': '#958777',
        sage: '#789A75',
        apricot: '#E8A85A',
        coral: '#D9786C',
        background: '#FFFFFF',
        surface: '#EEE8F7',
        foreground: '#625346',
        card: {
          DEFAULT: '#FFFFFF',
          hover: '#FAFAFA',
          border: '#E5E5E5',
        },
        primary: {
          DEFAULT: '#E8C65A',
          hover: '#DFBA48',
          lavender: '#B8A3D9',
        },
        secondary: {
          DEFAULT: '#EEE8F7',
          text: '#625346',
        },
        danger: '#D9786C',
        warning: '#E8A85A',
        success: '#789A75',
        info: '#B8A3D9',
        muted: {
          DEFAULT: '#958777',
          foreground: '#958777',
        },
        border: '#E5E5E5',
        input: '#FFFFFF',
        ring: '#B8A3D9',
      },
      borderRadius: {
        lg: '10px',
        xl: '12px',
        '2xl': '14px',
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(98, 83, 70, 0.04)',
        card: '0 2px 10px -2px rgba(98, 83, 70, 0.05), 0 1px 3px 0 rgba(98, 83, 70, 0.03)',
        elevated: '0 14px 32px -8px rgba(98, 83, 70, 0.10), 0 4px 12px -4px rgba(98, 83, 70, 0.05)',
      },
      keyframes: {
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'progress-flow': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.2s ease-out both',
        'progress-flow': 'progress-flow 1.4s ease-in-out infinite',
      },
      opacity: {
        18: '0.18',
        22: '0.22',
        32: '0.32',
      },
    },
  },
  plugins: [],
}
