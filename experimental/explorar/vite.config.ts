/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  build: {
    // three pesa; se carga de forma diferida y se parte en su propio chunk.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    // Lógica pura (grafo y navegación): no necesita DOM.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Procesa el CSS para que «?raw» devuelva el texto (lo usa la prueba de encapsulación).
    css: true,
  },
})
