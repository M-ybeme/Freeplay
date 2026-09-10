import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Freeplay',
        short_name: 'Freeplay',
        description: 'A personal, ad-free, local-first arcade. Pick a game, play.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#080612',
        background_color: '#080612',
        icons: [
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache everything the app actually needs offline (JS/CSS bundle,
        // the self-hosted Orbitron font files, the SVG/PNG icons) rather than
        // hand-listing runtime caching rules — Freeplay has no backend or API
        // calls to account for.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
      },
    }),
  ],
})
