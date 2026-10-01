import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Servidor de desarrollo
  server: {
    port: 3000,
    open: false,
    cors: true,
  },
  // Configuración de compilación multi-página
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        cliente: resolve(process.cwd(), 'cliente.html'),
      },
    },
  },
});
