import { defineConfig } from 'vite';
export default defineConfig({ base: process.env.CF_PAGES ? '/' : '/wasserlage/v3/', build: { target: 'es2020', sourcemap: false } });
