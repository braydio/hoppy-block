
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  server: {
    host: '0.0.0.0',         // IMPORTANT: not just `true`
    port: 5173,
    strictPort: true,

    allowedHosts: [
      'makeda-panoptic-chartographically.ngrok-free.dev',
      '.ngrok-free.dev',     // leading dot = wildcard in older Vite
    ],

    hmr: {
      host: 'makeda-panoptic-chartographically.ngrok-free.dev',
      protocol: 'wss',
    },
  },

  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})

