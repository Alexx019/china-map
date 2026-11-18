import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      // La web va detrás de una contraseña (basic auth): el manifest tiene que pedirse con credenciales
      useCredentials: true,
      injectManifest: {
        // Se precarga la app, fuentes, iconos y glifos del mapa. Fotos, datos y mapa van aparte
        // (src/sw.ts y «Preparar sin conexión»), porque pesan mucho o cambian.
        globPatterns: ['**/*.{js,mjs,css,html,woff2,svg,png}', 'map/fonts/**/*.pbf'],
        globIgnores: ['data/**', 'map/*.pmtiles'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'china-map',
        short_name: 'china-map',
        description: 'Guía privada de sitios del viaje: mapa, fichas y Amap.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ECEEF1',
        theme_color: '#ECEEF1',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { host: true },
  // MapLibre 6 carga su worker con new URL(..., import.meta.url): el pre-empaquetado lo rompe
  optimizeDeps: { exclude: ['maplibre-gl'] },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
