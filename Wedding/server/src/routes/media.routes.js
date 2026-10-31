// Serves stored photos, GIFs and videos. Published (approved) media is public;
// hidden ('rejected') or legacy pending items are only served to a signed-in
// admin (guests get the same 404 as for missing media). Site images
// (hero/story) are always public. Content-Type comes from the stored file's
// verified extension, with X-Content-Type-Options: nosniff set globally.
import express from 'express'
import { notFound } from '../lib/errors.js'
import { contentTypeForKey, resolveKey } from '../lib/storage.js'
import { loadSession } from '../services/auth.js'
import { fileForRequest } from '../services/photos.js'

// res.sendFile supports HTTP Range requests, which browsers (notably iOS Safari)
// need to play and seek videos.
function send(res, file, cacheControl, contentType) {
  res.set('Cache-Control', cacheControl)
  res.set('Content-Disposition', 'inline')
  res.type(contentType)
  return new Promise((resolve, reject) =>
    res.sendFile(file, { dotfiles: 'deny' }, (err) => (err ? reject(err.code === 'ENOENT' ? notFound() : err) : resolve())),
  )
}

export default function createMediaRoutes({ db }) {
  const router = express.Router()

  router.get('/photos/:id/:variant', async (req, res) => {
    const admin = await loadSession(db, req)
    const { key, isPublic } = await fileForRequest(db, req.params.id, req.params.variant, Boolean(admin))
    await send(res, resolveKey(key), isPublic ? 'public, max-age=3600' : 'private, no-store', contentTypeForKey(key))
  })

  router.get('/site/:file', async (req, res) => {
    let file
    try {
      file = resolveKey(`site/${req.params.file}`)
    } catch {
      throw notFound()
    }
    await send(res, file, 'public, max-age=31536000, immutable', 'image/jpeg')
  })

  return router
}
