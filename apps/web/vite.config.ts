import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // VITE_* settings live in the repo-root .env.local (see .env.example), or come from CI.
  envDir: '../..',
  server: { port: 5173 },
});
