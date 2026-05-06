/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}", 
    ],
    theme: {
      extend: {
        colors: {
          'fi-accent': '#facc15', 
        }
      },
    },
    plugins: [],
  }