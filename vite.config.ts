import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,

    allowedHosts: process.env.VITE_ALLOW_NGROK === '1' ? ['.ngrok-free.app', '.ngrok-free.dev'] : process.env.VITE_TUNNEL_HOST ? [process.env.VITE_TUNNEL_HOST] : [],
    hmr: process.env.VITE_TUNNEL_HOST ? { host: process.env.VITE_TUNNEL_HOST, protocol: 'wss' } : undefined,
  },

  plugins: [vue(), vueJsx(), vueDevTools(), VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'Hoppy Block', short_name: 'Hoppy Block',
      theme_color: '#020617', background_color: '#020617', display: 'standalone',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,png,ico,svg,mp3}'], maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 },
  })],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
