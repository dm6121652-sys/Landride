import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', includeAssets: ['landride.svg'], manifest: {
    name: 'Landride Campus Shuttle', short_name: 'Landride', description: 'Book campus shuttle rides at Landmark University.',
    theme_color: '#123b2c', background_color: '#f6f7f2', display: 'standalone', start_url: '/',
    icons: [{ src: '/landride.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
  } })],
})
