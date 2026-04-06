import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = String(env.VITE_API_URL || 'https://iqac-system.onrender.com/api').replace(/\/+$/, '');
  const apiOrigin = apiUrl.replace(/\/api$/, '');

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: apiOrigin,
          changeOrigin: true,
        },
      },
    },
  };
});
