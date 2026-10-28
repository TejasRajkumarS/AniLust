import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const amvstrmBase = env.VITE_AMVSTRM_API_URL || 'https://api-amvstrm.nyt92.eu.org';
  return {
    // FIX: Use the repository name surrounded by slashes
    base: '/AniLust/',

    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'https://consumet-api-one.vercel.app',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        // Amvstrm API proxy (avoids CORS in dev)
        '/amvstrm-api': {
          target: amvstrmBase,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/amvstrm-api/, ''),
        },
        // Consumet Gogoanime fallback proxy
        '/consumet-gogo': {
          target: 'https://consumet-api.onrender.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/consumet-gogo/, ''),
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['hls.js', '@google/genai']
          }
        }
      }
    }
  };
});