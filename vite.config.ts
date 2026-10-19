import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  const demoMode = env.VITE_DEMO_MODE === 'true';

  return {
    plugins: [react()],
    define: {
      // Static flag so demo data is tree-shaken out of production builds.
      __DEMO_MODE__: JSON.stringify(demoMode),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
    preview: {
      port: 5173,
      host: true,
    },
  };
});
