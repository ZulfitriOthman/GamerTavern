import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Same-origin API: /api → Wedding/server (npm run dev in server/).
const apiProxy = {
  '/api': { target: process.env.WEDDING_API_PROXY || 'http://localhost:4100', changeOrigin: false },
}

const allowedHosts = [
  'localhost',
  '127.0.0.1',
  'all',

  // ✅ your domain(s)
  'devwedding.nanashicollectibles.com',
]

// Dev server only. When the dev server is reached through Cloudflare, `.js`
// source modules (e.g. src/lib/useAsync.js) are given a 4-hour browser cache
// lifetime, while `.jsx` modules are not. After Vite re-optimizes its
// dependencies, browsers then mix an old cached module (pointing at the old
// React copy) with new ones → two Reacts → "Cannot read properties of null
// (reading 'useState')". Marking source modules no-store keeps them in sync.
// Production builds are unaffected (hashed filenames are safe to cache).
const noStoreSourceModules = {
  name: 'wedding:no-store-source-modules',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/src/')) {
        const setHeader = res.setHeader.bind(res)
        res.setHeader = (name, value) =>
          setHeader(name, String(name).toLowerCase() === 'cache-control' ? 'no-store' : value)
        setHeader('Cache-Control', 'no-store')
      }
      next()
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), noStoreSourceModules],
  // qrcode is only imported by the lazy admin chunk; pre-bundle it at startup so
  // a long-running dev server doesn't serve a stale ("504 Outdated Optimize Dep") copy.
  optimizeDeps: { include: ['qrcode'] },
  build: {
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks so returning guests re-download only app code.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'motion', test: /node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    host: true, // allow network access
    port: 5174,
    proxy: apiProxy,
    allowedHosts,
  },
  // `npm run serve` — serves the production build on the same port, hosts and
  // /api proxy, so the public domain can switch from the dev server to built
  // files without changing the tunnel / reverse-proxy configuration.
  preview: {
    host: true,
    port: 5174,
    strictPort: true,
    proxy: apiProxy,
    allowedHosts,
  },
})
