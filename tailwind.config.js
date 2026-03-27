/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Sora', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: '#0A0A0A',
        foreground: '#F0F0F0',
        card: {
          DEFAULT: '#111111',
          hover: '#161616',
          border: 'rgba(255,255,255,0.06)',
        },
        primary: {
          DEFAULT: '#F5C518',
          gradient: 'linear-gradient(135deg, #F5C518, #FFB347)',
          amber: '#FFB347',
        },
        secondary: {
          DEFAULT: '#1A1A1A',
          text: '#888888',
        },
        danger: '#FF4444',
        success: '#00C896',
        muted: {
          DEFAULT: '#888888',
          foreground: '#888888',
        },
        border: 'rgba(255,255,255,0.06)',
        input: '#1A1A1A',
        ring: '#F5C518',
      },
      borderRadius: {
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
      },
      boxShadow: {
        premium: '0 10px 40px -10px rgba(0,0,0,0.5), 0 0 20px rgba(255,179,71,0.03)',
        gold: '0 0 30px rgba(245,197,24,0.15), 0 4px 10px rgba(0,0,0,0.4)',
      },
      keyframes: {
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'marquee': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'progress-flow': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(245,197,24,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(245,197,24,0.5)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.4s ease-out both',
        'slide-up': 'slide-up 0.4s ease-out both',
        'marquee': 'marquee 40s linear infinite',
        'shimmer': 'shimmer 2s infinite linear',
        'progress-flow': 'progress-flow 1.5s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
