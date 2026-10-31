import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  // Remote bindings (Workers AI) need `wrangler login`; opt in with CF_REMOTE=1.
  plugins: [react(), tailwindcss(), cloudflare({ remoteBindings: process.env.CF_REMOTE === '1' })],
});
