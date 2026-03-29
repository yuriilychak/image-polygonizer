/// <reference types="vitest" />
import path from 'path';
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
  resolve: {
    alias: {
      'image-polygonizer': path.resolve(__dirname, '../image-polygonizer/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/index.ts',
        'src/**/constants.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
  },
});
