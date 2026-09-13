/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          500: '#2f6fed',
          600: '#2557c7',
          700: '#1d439c',
        },
      },
    },
  },
  plugins: [],
};
