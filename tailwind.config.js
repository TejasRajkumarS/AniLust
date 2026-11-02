/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'primary': '#a855f7',
        'background-dark': '#050505',
        'card-dark': '#121212',
        'accent-dark': '#1a1a1a',
      },
      fontFamily: {
        'display': ['Spline Sans', 'sans-serif'],
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 3s infinite',
      },
    },
  },
  plugins: [],
};
