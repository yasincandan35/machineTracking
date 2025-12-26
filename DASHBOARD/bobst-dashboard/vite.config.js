import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: [
      'track.bychome.xyz',
      'yyc.bychome.xyz',
      'livedata.bychome.xyz',
      'basedata.bychome.xyz',
      '.bychome.xyz',
      'localhost',
      '192.168.1.44',
      '192.168.1.237'
    ],
    watch: {
      usePolling: true
    }
  }
});

