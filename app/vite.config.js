import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  // Vite loads .env from here; was '..' (parent) so app/.env was never read
  envDir: __dirname,
  server: {
    port: 5173,
    open: true,
  },
});
