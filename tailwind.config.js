/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'app-bg': '#030303',
        'panel-bg': '#0a0a0a',
        'primary': '#22d3ee',
        'primary-hover': '#06b6d4',
        'secondary': '#94a3b8',
        'muted': '#64748b',
        'border': 'rgba(255,255,255,0.08)',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(34, 211, 238, 0.15)',
        '4xl': '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
