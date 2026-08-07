/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0b0f14',
          800: '#111823',
          700: '#18212e',
          600: '#222d3d',
          500: '#334156',
        },
        accent: {
          DEFAULT: '#38bdf8',
          soft: '#0ea5e9',
        },
        run: '#f59e0b',
        lift: '#38bdf8',
        rest: '#64748b',
      },
      fontSize: {
        tap: ['1.05rem', { lineHeight: '1.3rem' }],
      },
    },
  },
  plugins: [],
}
