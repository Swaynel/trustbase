/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        earth: {
          50:  '#fdf8f0',
          100: '#f7e8d4',
          200: '#edd0a8',
          300: '#dfb07a',
          400: '#d08f52',
          500: '#c07030',
          600: '#a85a22',
          700: '#8a451b',
          800: '#6e3418',
          900: '#5a2a14',
        },
        forest: {
          400: '#4a8c5c',
          500: '#3a7a4a',
          600: '#2d6438',
        },
        sand: {
          50:  '#fffdf5',
          100: '#fdf6e3',
          200: '#f9ead0',
        },
        ink: {
          900: '#1a1208',
          800: '#2e1f0e',
          700: '#3d2a12',
        }
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body:    ['var(--font-body)', 'sans-serif'],
        mono:    ['var(--font-mono)', 'monospace'],
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}
