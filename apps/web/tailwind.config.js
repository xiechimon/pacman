/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // r1 §4.2 semantic families: variable names --text-*, class names content-*
        content: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          dim: 'var(--text-dim)',
        },
        line: {
          DEFAULT: 'var(--border-default)',
          strong: 'var(--border-strong)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          secondary: 'var(--surface-secondary)',
          tertiary: 'var(--surface-tertiary)',
          inset: 'var(--surface-inset)',
          elevated: 'var(--surface-elevated)',
          hover: 'var(--surface-hover)',
        },
        // board palette sampled in prototype #42 (replica.css)
        'col-bg': 'var(--col-bg)',
        'card-bg': 'var(--card-bg)',
        'card-border': 'var(--card-border)',
        'col-head-text': 'var(--col-head-text)',
        accent: {
          indigo: 'var(--indigo-500)',
          'indigo-strong': 'var(--indigo-600)',
          blue: 'var(--blue-500)',
          amber: 'var(--amber-500)',
          green: 'var(--green-500)',
          rose: 'var(--rose-500)',
          gray: 'var(--gray-400)',
        },
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
    },
  },
  plugins: [
    // r1 §4.3: official inverse dark variant. Dark is the :root default,
    // light is opted in via .light on the root element.
    ({ addVariant }) => {
      addVariant('dark', '&:where(:not(.light):not(.light *))');
    },
  ],
};
