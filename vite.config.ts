import { defineConfig } from 'vite';
export default defineConfig({
  // Preserve the browser's host so the API can enforce same-origin writes.
  server: { host: '0.0.0.0', port: 5173, proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } } },
});
