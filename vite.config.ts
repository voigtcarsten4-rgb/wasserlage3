import { defineConfig } from 'vite';
export default defineConfig({
  base: process.env.CF_PAGES ? '/' : '/wasserlage/v3/',
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('maplibre-gl')) return 'maplibre';
          if (id.includes('node_modules/three')) return 'three';
        },
      },
    },
  },
});
