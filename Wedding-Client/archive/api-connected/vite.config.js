import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Same-origin API in development: /api → this site's own Wedding API instance (npm run dev:api, port 4101).
// Port 4100 is the Zulfitri & Mariah API; it must never be this site's default.
// changeOrigin stays false so the API's same-origin check accepts proxied writes.
const apiProxy = {
  '/api': { target: process.env.WEDDING_API_PROXY || 'http://localhost:4101', changeOrigin: false },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'motion', test: /node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/ },
          ],
        },
      },
    },
  },
  server: { host: true, port: 5174, proxy: apiProxy },
  preview: { host: true, port: 5174, proxy: apiProxy },
})
