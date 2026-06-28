/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        brand: ['Fredoka', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        quantum: {
          50: '#f0f4ff',
          100: '#e6eeff',
          200: '#c7d5ff',
          300: '#a8bcff',
          400: '#7f8eff',
          500: '#5f5fff',
          600: '#6f3eff',
          700: '#5528d9',
          800: '#3d1fa8',
          900: '#2a1377',
        },
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'quantum-lissajous': 'quantumLissajous 16s cubic-bezier(0.37, 0, 0.63, 1) infinite',
        'quantum-lissajous-slow': 'quantumLissajous 22s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite reverse',
        'quantum-ring-pulse': 'quantumRingPulse 7s ease-in-out infinite',
        'quantum-spin-ease': 'quantumSpinEase 20s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'quantum-bob-a': 'quantumBobA 5.5s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
        'quantum-bob-b': 'quantumBobB 5.5s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
        'quantum-wobble': 'quantumWobble 10s ease-in-out infinite',
        'quantum-link-pulse': 'quantumLinkPulse 4.5s ease-in-out infinite',
        'quantum-wave-a': 'quantumWaveA 6s cubic-bezier(0.36, 0, 0.64, 1) infinite',
        'quantum-wave-b': 'quantumWaveB 6s cubic-bezier(0.36, 0, 0.64, 1) infinite',
        'quantum-wave-c': 'quantumWaveC 6s cubic-bezier(0.36, 0, 0.64, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        quantumLissajous: {
          '0%': { transform: 'translate(0, 0)' },
          '20%': { transform: 'translate(12px, -9px)' },
          '45%': { transform: 'translate(-5px, -18px)' },
          '70%': { transform: 'translate(-14px, 7px)' },
          '100%': { transform: 'translate(0, 0)' },
        },
        quantumRingPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.28' },
          '35%': { transform: 'scale(1.1)', opacity: '0.5' },
          '65%': { transform: 'scale(0.94)', opacity: '0.18' },
        },
        quantumSpinEase: {
          '0%': { transform: 'rotate(0deg)' },
          '30%': { transform: 'rotate(95deg)' },
          '65%': { transform: 'rotate(210deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        quantumBobA: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '28%': { transform: 'translate(5px, -7px) scale(1.12)' },
          '62%': { transform: 'translate(-4px, 6px) scale(0.88)' },
        },
        quantumBobB: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '28%': { transform: 'translate(-5px, 6px) scale(0.9)' },
          '62%': { transform: 'translate(6px, -5px) scale(1.1)' },
        },
        quantumWobble: {
          '0%, 100%': { transform: 'translateX(0) rotate(0deg)' },
          '25%': { transform: 'translateX(7px) rotate(1.5deg)' },
          '75%': { transform: 'translateX(-9px) rotate(-1.5deg)' },
        },
        quantumLinkPulse: {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.85' },
        },
        quantumWaveA: {
          '0%, 100%': { transform: 'translate(0, -6px)' },
          '50%': { transform: 'translate(4px, 8px)' },
        },
        quantumWaveB: {
          '0%, 100%': { transform: 'translate(-50%, 5px)' },
          '50%': { transform: 'translate(-50%, -9px)' },
        },
        quantumWaveC: {
          '0%, 100%': { transform: 'translate(0, 4px)' },
          '50%': { transform: 'translate(-5px, -7px)' },
        },
      },
    },
  },
  plugins: [],
};
