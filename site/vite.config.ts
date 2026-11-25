import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Os artigos vivem em ../docs/research e sao importados como texto (?raw): o servidor de
  // desenvolvimento so pode servir esta pasta alem do proprio site, nunca o repositorio todo.
  server: { fs: { allow: ['.', '../docs/research'] } },
});
