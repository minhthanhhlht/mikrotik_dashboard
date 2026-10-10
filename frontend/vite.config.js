import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dev server trỏ /api sang backend proxy (Express) chạy trên cổng 3000
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/app-[hash].js`,
        chunkFileNames: `assets/chunk-[hash].js`,
        assetFileNames: `assets/style-[hash].[ext]`,
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Quan trọng cho SSE realtime: không proxy-timeout → duy trì kết nối
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
});