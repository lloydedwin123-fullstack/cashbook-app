import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // Safe list of environment variables to expose to the browser
  const processEnvValues = {
    API_KEY: env.API_KEY,
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY
  };

  return {
    plugins: [react()],
    define: {
      'process.env': processEnvValues
    },
    build: {
      outDir: 'dist',
    }
  };
});