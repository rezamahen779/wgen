/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        wgen: {
          lightBg: '#F3F4F6',
          darkBg: '#022c22',
          emerald: '#10B981',
          cyan: '#06B6D4',
        }
      }
    },
  },
  plugins: [],
}