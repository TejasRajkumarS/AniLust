import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    // FIX: Use the repository name surrounded by slashes
    base: '/AniLust/',

    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@google/genai')) return 'genai';
              if (id.includes('hls.js')) return 'hls';
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'vendor';
              return 'vendor';
            }
          }
        }
      }
    }
  };
});