import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  worker: { format: 'es' }, // required: pdfjs worker is an ES module
  optimizeDeps: { exclude: ['pdfjs-dist'] },
  build: { target: 'es2022' },
});
