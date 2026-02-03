import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    alias: {
      '@tauri-apps/api/tauri': path.resolve(__dirname, './src/__mocks__/tauri.ts'),
      '@tauri-apps/api': path.resolve(__dirname, './src/__mocks__/tauri-api.ts'),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tauri-apps/api/tauri': path.resolve(__dirname, './src/__mocks__/tauri.ts'),
      '@tauri-apps/api': path.resolve(__dirname, './src/__mocks__/tauri-api.ts'),
    },
  },
});
