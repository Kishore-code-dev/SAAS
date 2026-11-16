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
        'butter-cream': '#F7F0D9',
        'pale-lavender': '#EEE8F7',
        'vanilla-cream': '#F4EBD5',
        'soft-cream': '#FBF6E6',
        'golden-yellow': '#E8C65A',
        'royal-lavender': '#B8A3D9',
        cocoa: '#625346',
        'muted-cocoa': '#7D6D5F',
        sage: '#789A75',
        coral: '#D9786C',
        background: '#F7F0D9',
        surface: '#EEE8F7',
        foreground: '#625346',
        card: {
          DEFAULT: '#F4EBD5',
          hover: '#FBF6E6',
          border: '#E0D4B7',
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
        warning: '#E8C65A',
        success: '#789A75',
        info: '#B8A3D9',
        muted: {
          DEFAULT: '#7D6D5F',
          foreground: '#7D6D5F',
        },
        border: '#E0D4B7',
        input: '#FBF6E6',
        ring: '#B8A3D9',
      },
      borderRadius: {
        lg: '10px',
        xl: '12px',
        '2xl': '14px',
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(98, 83, 70, 0.05)',
        card: '0 1px 3px 0 rgba(98, 83, 70, 0.06), 0 1px 2px -1px rgba(98, 83, 70, 0.04)',
        elevated: '0 12px 28px -6px rgba(98, 83, 70, 0.10), 0 4px 10px -4px rgba(98, 83, 70, 0.06)',
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
    },
  },
  plugins: [],
}
