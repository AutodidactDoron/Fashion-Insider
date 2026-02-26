import { createClient } from '@supabase/supabase-js';

// טעינת מפתחות מ-.env; אם חסר – גיבוי לאותם ערכים כמו ב-auth-config כדי שה-fetch יגיע ל-Supabase
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://muwybkkadpqycpfhisyb.supabase.co').trim().replace(/\/$/, '');
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11d3lia2thZHBxeWNwZmhpc3liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDE0MDAsImV4cCI6MjA4NjM3NzQwMH0.T5G5papBIEQLHT7L3mDC7DL4pG8eptgXkXB3BbV66h8').trim();
console.log("URL from ENV file: ", import.meta.env.VITE_SUPABASE_URL);
console.log("KEY from ENV file: ", import.meta.env.VITE_SUPABASE_ANON_KEY);
console.log("The URL the app is ACTUALLY using: ", supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
