const withOpacity = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.25rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '2.5rem',
      },
    },
    extend: {
      fontFamily: {
        sans: ['Geist', 'Inter', 'ui-sans-serif', 'sans-serif'],
        display: ['Geist', 'Inter', 'ui-sans-serif', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#dce6ff',
          200: '#b9cdff',
          300: '#85a9ff',
          400: '#4d7eff',
          500: '#1a52ff',
          600: '#0035e6',
          700: '#002bba',
          800: '#002097',
          900: '#001a7a',
        },
        canvas: withOpacity('--color-canvas'),
        panel: {
          DEFAULT: withOpacity('--color-panel'),
          elevated: withOpacity('--color-panel-elevated'),
          muted: withOpacity('--color-panel-muted'),
          subtle: withOpacity('--color-panel-subtle'),
        },
        line: {
          DEFAULT: withOpacity('--color-line'),
          strong: withOpacity('--color-line-strong'),
        },
        content: {
          primary: withOpacity('--color-content-primary'),
          secondary: withOpacity('--color-content-secondary'),
          muted: withOpacity('--color-content-muted'),
        },
        success: withOpacity('--color-success'),
        warning: withOpacity('--color-warning'),
        danger: withOpacity('--color-danger'),
        info: withOpacity('--color-info'),
        surface: {
          DEFAULT: withOpacity('--color-canvas'),
          card: withOpacity('--color-panel'),
          border: withOpacity('--color-line'),
          hover: withOpacity('--color-panel-muted'),
        },
      },
      borderRadius: {
        card: 'var(--radius-card)',
        shell: 'var(--radius-shell)',
        pill: '999px',
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        elevated: 'var(--shadow-elevated)',
        float: '0 24px 60px -36px rgba(6, 9, 20, 0.7)',
      },
      maxWidth: {
        dashboard: '96rem',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        30: '7.5rem',
      },
      backgroundImage: {
        'dashboard-grid': "linear-gradient(to right, rgba(74, 92, 138, 0.11) 1px, transparent 1px), linear-gradient(to bottom, rgba(74, 92, 138, 0.11) 1px, transparent 1px)",
        'dashboard-glow': 'radial-gradient(circle at top left, rgba(77, 126, 255, 0.22), transparent 32%), radial-gradient(circle at 85% 18%, rgba(56, 189, 248, 0.16), transparent 28%), radial-gradient(circle at bottom right, rgba(250, 204, 21, 0.12), transparent 30%)',
      },
    },
  },
  plugins: [],
};
