import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveApiBaseUrl, resolveApiOrigin } from './src/config/apiBase.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = resolveApiBaseUrl(env);
  const apiOrigin = resolveApiOrigin(env);

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
