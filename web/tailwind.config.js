/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Helix Void Pulse Design System
        // Primary Blue - Main brand color
        helix: {
          50: '#e6f4fc',
          100: '#cce9f9',
          200: '#99d3f3',
          300: '#66bded',
          400: '#33a7e7',
          500: '#0686D4', // Primary
          600: '#056fb0',
          700: '#04588c',
          800: '#034168',
          900: '#022a44',
          950: '#011522',
        },
        // Accent Purple - Secondary accent
        accent: {
          50: '#f3ebfe',
          100: '#e7d7fd',
          200: '#cfaffb',
          300: '#b787f9',
          400: '#9f5ff7',
          500: '#7234ED', // Accent
          600: '#5b2abe',
          700: '#44208e',
          800: '#2d155f',
          900: '#170b2f',
          950: '#0b0518',
        },
        // Void Backgrounds
        void: '#050505',
        'bg-primary': '#0a0a0a',
        'bg-secondary': '#111111',
        'bg-tertiary': '#1a1a1a',
        'bg-quaternary': '#222222',
        // Text Colors
        'text-primary': '#FAFAFA',
        'text-secondary': '#A1A1AA',
        'text-tertiary': '#71717A',
        // Semantic Colors
        success: {
          light: '#4ade80',
          DEFAULT: '#22C55E',
          dark: '#16a34a',
        },
        danger: {
          light: '#f87171',
          DEFAULT: '#EF4444',
          dark: '#dc2626',
        },
        warning: {
          light: '#fbbf24',
          DEFAULT: '#F59E0B',
          dark: '#d97706',
        },
      },
      fontFamily: {
        display: ['Syne', 'Outfit', 'system-ui', 'sans-serif'],
        body: ['DM Sans', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'display-2xl': ['4.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-xl': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-lg': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.015em' }],
        'display-md': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'display-sm': ['1.875rem', { lineHeight: '1.25' }],
      },
      borderColor: {
        subtle: 'rgba(255, 255, 255, 0.06)',
        default: 'rgba(255, 255, 255, 0.1)',
        'accent-blue': 'rgba(6, 134, 212, 0.3)',
        'accent-purple': 'rgba(114, 52, 237, 0.3)',
      },
      boxShadow: {
        'glow-blue': '0 0 40px rgba(6, 134, 212, 0.15)',
        'glow-blue-intense': '0 0 60px rgba(6, 134, 212, 0.25)',
        'glow-purple': '0 0 40px rgba(114, 52, 237, 0.15)',
        'glow-purple-intense': '0 0 60px rgba(114, 52, 237, 0.25)',
        'glow-mixed': '0 0 60px rgba(6, 134, 212, 0.15), 0 0 40px rgba(114, 52, 237, 0.1)',
        'card-elevated': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 12px 48px rgba(0, 0, 0, 0.5)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-helix': 'linear-gradient(135deg, #0686D4, #7234ED)',
        'gradient-helix-reverse': 'linear-gradient(135deg, #7234ED, #0686D4)',
        'shimmer': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)',
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s ease-out',
        'fade-in-down': 'fade-in-down 0.5s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'pulse-glow-slow': 'pulse-glow 4s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite linear',
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'float-badge': 'float-badge 4s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 20s ease-in-out infinite',
        'ring-rotate-slow': 'ring-rotate 60s linear infinite',
        'ring-rotate-medium': 'ring-rotate 45s linear infinite reverse',
        'ring-rotate-fast': 'ring-rotate 30s linear infinite',
        'hero-reveal': 'hero-reveal 1s cubic-bezier(0.16, 1, 0.3, 1)',
        'hero-reveal-delay-1': 'hero-reveal 1s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both',
        'hero-reveal-delay-2': 'hero-reveal 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both',
        'hero-reveal-delay-3': 'hero-reveal 1s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both',
        'hero-reveal-delay-4': 'hero-reveal 1s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both',
        'hero-reveal-delay-5': 'hero-reveal 1s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both',
        'spin-slow': 'spin 20s linear infinite',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(6, 134, 212, 0.15)' },
          '50%': { boxShadow: '0 0 40px rgba(6, 134, 212, 0.25)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'float-badge': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'gradient-shift': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '25%': { transform: 'translate(10%, 10%) scale(1.05)' },
          '50%': { transform: 'translate(-5%, 15%) scale(0.95)' },
          '75%': { transform: 'translate(-10%, -5%) scale(1.02)' },
        },
        'ring-rotate': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'hero-reveal': {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      transitionTimingFunction: {
        'bounce-out': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
