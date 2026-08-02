import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      // database.json is the dev JSON "database" written on every API save — it lives in the
      // watched root, so without this it forces a full page reload (wiping all app state) on
      // every backend write, e.g. clicking Kaydet/Save anywhere in the app.
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/database.json'] },
    },
  };
});
