import { defineConfig } from 'vite';

export default defineConfig({
  // Dev: http://localhost:5173/
  // Prod: http://craft.rafter.com.cn/
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
    open: true,
  },
});
