/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // הכחול של הכפתורים והטקסטים (במקום הכתום)
        'fi-accent': '#3b82f6', // Royal Blue
        
        // הרקע הכחול-כהה שהיה לך במקור (GitHub Dark Mode)
        'fi-dark': '#0d1117',   
        
        // צבע טיפה יותר בהיר לאלמנטים צפים (מודאלים/כרטיסיות)
        'fi-surface': '#161b22' 
      }
    },
  },
  plugins: [],
}