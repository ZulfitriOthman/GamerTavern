import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { weddingData } from './src/data/weddingData.js'
import { coupleShort } from './src/lib/content.js'

// Static site: no API proxy, no backend. Everything comes from src/data/weddingData.js.

// Fills %SITE_TITLE% etc. in index.html from weddingData.site, so the browser
// tab and WhatsApp/social link previews use the same central data.
// WhatsApp needs absolute links, so the page and image URLs are built from
// site.url. The image URL carries a hash of the file, so a regenerated image
// is fetched again instead of WhatsApp reusing its cached copy.
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const weddingMeta = () => ({
  name: 'wedding-meta',
  transformIndexHtml: (html) => {
    const { site, couple } = weddingData
    const pageUrl = new URL('/', site.url).href
    const version = createHash('sha256').update(readFileSync(new URL(`./public${site.ogImage}`, import.meta.url))).digest('hex').slice(0, 8)
    const imageUrl = `${new URL(site.ogImage, site.url).href}?v=${version}`
    return html
      .replaceAll('%SITE_TITLE%', escapeHtml(site.title))
      .replaceAll('%SITE_NAME%', escapeHtml(coupleShort(couple)))
      .replaceAll('%SITE_DESCRIPTION%', escapeHtml(site.description))
      .replaceAll('%SITE_URL%', escapeHtml(pageUrl))
      .replaceAll('%SITE_IMAGE%', escapeHtml(imageUrl))
  },
})
const allowedHosts = [
  'localhost',
  '127.0.0.1',
  'all',

  // ✅ your domain(s)
  'devwedding.nanashicollectibles.com',
]

export default defineConfig({
  plugins: [react(), tailwindcss(), weddingMeta()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'motion', test: /node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/ },
          ],
        },
      },
    },
  },
  
  server: {
    host: true, // allow network access
    port: 5173,
    allowedHosts,
  },
    preview: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts,
  },
})
