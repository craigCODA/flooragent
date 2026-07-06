import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// IMPORTANT for Electron file:// loading
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
