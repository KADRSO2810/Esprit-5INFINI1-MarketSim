/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        obsidian: {
          950: '#070B14',
          900: '#0B1220',
          850: '#101A2B',
          800: '#142035',
          750: '#192841',
        },
        quant: {
          cyan: '#38BDF8',
          blue: '#3B82F6',
          violet: '#8B5CF6',
          bullish: '#22C55E',
          bearish: '#EF4444',
          neutral: '#94A3B8',
          warning: '#F59E0B',
        },
        market: {
          dark: '#070B14',
          card: '#101A2B',
          accent: '#38BDF8',
          success: '#22C55E',
          danger: '#EF4444',
          warning: '#F59E0B',
        }
      },
      borderColor: {
        subtle: 'rgba(148, 163, 184, 0.12)',
        strong: 'rgba(148, 163, 184, 0.24)',
      },
      boxShadow: {
        'panel': '0 10px 30px -10px rgba(0, 0, 0, 0.65), inset 0 1px 0 0 rgba(255, 255, 255, 0.04)',
        'panel-hover': '0 16px 36px -12px rgba(0, 0, 0, 0.78), inset 0 1px 0 0 rgba(255, 255, 255, 0.07)',
        'glow-cyan': '0 0 26px -6px rgba(56, 189, 248, 0.34)',
        'glow-violet': '0 0 26px -6px rgba(139, 92, 246, 0.34)',
        'glow-bull': '0 0 22px -6px rgba(34, 197, 94, 0.3)',
        'glow-bear': '0 0 22px -6px rgba(239, 68, 68, 0.3)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeSlideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        toastProgress: {
          '0%': { transform: 'scaleX(1)' },
          '100%': { transform: 'scaleX(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        orbitalSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        orbitalReverse: {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        aiBarSweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(260%)' },
        },
        drawLine: {
          '0%': { strokeDashoffset: '1000' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.8s linear infinite',
        'fade-slide-up': 'fadeSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fadeIn 0.22s ease-out forwards',
        'toast-in': 'toastIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'toast-progress': 'toastProgress 4.5s linear forwards',
        marquee: 'marquee 48s linear infinite',
        'orbital-spin': 'orbitalSpin 2.2s linear infinite',
        'orbital-reverse': 'orbitalReverse 3.1s linear infinite',
        'ai-sweep': 'aiBarSweep 2.4s ease-in-out infinite',
        'draw-line': 'drawLine 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }
    },
  },
  plugins: [],
}
