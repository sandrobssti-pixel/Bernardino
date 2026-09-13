/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: {
          950: '#05070f',
          900: '#0a0f1e',
          850: '#0d1326',
          800: '#111a30',
          700: '#182544',
          600: '#22335c',
          500: '#324879',
          400: '#5b6d99',
          300: '#8b98bd',
        },
        brand: {
          50: '#eef0ff',
          100: '#d9dcff',
          300: '#aba8ff',
          400: '#8b7bff',
          500: '#6d5efc',
          600: '#5945e0',
          700: '#46349f',
        },
        accent: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(109,94,252,0.45), 0 0 28px -6px rgba(109,94,252,0.65)',
        'glow-cyan': '0 0 0 1px rgba(34,211,238,0.4), 0 0 24px -6px rgba(34,211,238,0.55)',
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #6d5efc 0%, #22d3ee 100%)',
        'ink-radial': 'radial-gradient(120% 120% at 10% 0%, #182544 0%, #0a0f1e 55%)',
      },
      animation: {
        'pulse-slow': 'pulse 2.4s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [],
};
