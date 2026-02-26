# Fashion Insider – React app (Login / Signup)

Uses the **root `.env`** for Supabase:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Run the app

From the project root:

```bash
cd app
npm install
npm run dev
```

Then open **http://localhost:5173** to see the login page.

## Supabase client

`src/supabaseClient.js` reads from `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY` (provided by Vite from the root `.env`).
