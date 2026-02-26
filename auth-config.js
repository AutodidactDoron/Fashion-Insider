// Supabase config for vanilla HTML pages (login.html, signup.html, index.html).
// Same values as in root .env for the React app (VITE_SUPABASE_*).
// גזירת רווחים מיותרים כדי שה-URL לא יישבר ובקשה תגיע לשרת
window.SUPABASE_URL = (window.SUPABASE_URL || 'https://muwybkkadpqycpfhisyb.supabase.co').trim().replace(/\/$/, '');
window.SUPABASE_ANON_KEY = (window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11d3lia2thZHBxeWNwZmhpc3liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDE0MDAsImV4cCI6MjA4NjM3NzQwMH0.T5G5papBIEQLHT7L3mDC7DL4pG8eptgXkXB3BbV66h8').trim();
