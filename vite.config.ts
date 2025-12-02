import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Petty Cash Flow',
        short_name: 'CashFlow',
        description: 'Smart petty cash management with AI insights',
        theme_color: '#4f46e5',
        background_color: '#f3f4f6',
        start_url: '/',
        display: 'standalone',
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/10543/10543263.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      devOptions: {
        enabled: true, // Enable PWA in development
      },
      workbox: {
        // Since we have a manual service-worker.js for the preview, 
        // we need to be careful not to conflict if we want Vite to generate one.
        // For Vercel deployment, VitePWA will generate 'sw.js' or similar.
      }
    }),
  ],
  server: {
    open: true,
  },
  build: {
    outDir: 'dist',
  },
});
