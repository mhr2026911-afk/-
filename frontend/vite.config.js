import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Inside the preview sandbox the app is served through a rotating proxy host,
// so Vite has to accept that hostname (and never any other).
const sandboxHost = process.env.BASE44_SANDBOX_HOST_DOMAIN
const previewMode = process.env.BASE44_PREVIEW_MODE === '1'
const allowedHosts = previewMode && sandboxHost ? [`.${sandboxHost}`] : []

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts,
    proxy: {
      '/api': {
        target: 'http://api:8000',
        changeOrigin: false,
      },
      '/ws': {
        target: 'ws://api:8000',
        ws: true,
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
})
