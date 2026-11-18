import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: true },
  // MapLibre 6 carga su worker con new URL(..., import.meta.url): el pre-empaquetado lo rompe
  optimizeDeps: { exclude: ['maplibre-gl'] },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
