import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const motor = fileURLToPath(new URL('../../packages/motor/src/index.ts', import.meta.url));

const proxy = { '/api': { target: 'http://localhost:3333', changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@promec/motor': motor } },
  server: { port: 5273, strictPort: true, proxy },
  preview: { port: 5273, strictPort: true, proxy },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] }
});
