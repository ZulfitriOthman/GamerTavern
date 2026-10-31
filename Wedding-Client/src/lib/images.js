// Wedding photos live in src/assets/wedding/. Vite lists the files that exist at
// build time, so weddingData.js can name photos by file name ("hero.jpg") and a
// missing file simply shows a placeholder — no 404 requests, no broken images.
const files = import.meta.glob('../assets/wedding/*.{jpg,jpeg,png,webp,avif}', { eager: true, import: 'default' })

const byName = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split('/').pop().toLowerCase(), url]))

/** "hero.jpg" → bundled URL, '' if the file isn't there. Absolute URLs and /paths pass through. */
export function imageUrl(name) {
  if (!name) return ''
  if (/^(https:|\/)/i.test(name)) return name
  return byName[name.toLowerCase()] ?? ''
}
