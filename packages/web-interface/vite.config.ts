import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/image-polygonizer/' : '/',
  plugins: [react()],
  publicDir: '../../dist',
  build: {
    outDir: '../../dist',
    emptyOutDir: false,
    copyPublicDir: false,
    sourcemap: true,
    rollupOptions: {
      external: ['image-polygonizer'],
    },
  },
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
});
