/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          'fi-accent': '#facc15', // Signature Gold/Yellow
          'fi-dark': '#111113',   // Core Background Dark
          'fi-surface': '#1c1c1f' // Elevated Surface Dark
        }
      },
    },
    plugins: [],
  }