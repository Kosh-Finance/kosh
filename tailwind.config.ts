import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Kosh design system — matches kosh.finance
        bg: '#06070B',
        surface: 'rgba(255,255,255,0.03)',
        'surface-hover': 'rgba(255,255,255,0.05)',
        border: 'rgba(255,255,255,0.08)',
        'border-violet': 'rgba(139,92,246,0.4)',

        // Brand accents
        violet: '#8B5CF6',
        'violet-dim': 'rgba(139,92,246,0.15)',
        cyan: '#06B6D4',
        'cyan-dim': 'rgba(6,182,212,0.15)',
        amber: '#F59E0B',
        'amber-dim': 'rgba(245,158,11,0.15)',

        // Status
        green: '#22C55E',
        'green-dim': 'rgba(34,197,94,0.15)',
        red: '#EF4444',
        'red-dim': 'rgba(239,68,68,0.15)',

        // Text
        text: 'rgba(255,255,255,0.90)',
        'text-muted': 'rgba(255,255,255,0.50)',
        'text-faint': 'rgba(255,255,255,0.28)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        card: '16px',
        pill: '999px',
      },
      animation: {
        'fade-up': 'fadeUp 400ms cubic-bezier(.4,0,.2,1) forwards',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
      transitionTimingFunction: {
        kosh: 'cubic-bezier(.4,0,.2,1)',
      },
    },
  },
  plugins: [],
};

export default config;
