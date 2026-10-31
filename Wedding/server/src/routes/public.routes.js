// Guest-facing endpoints. No authentication; every write is validated,
// de-duplicated and rate-limited in the service layer.
import crypto from 'node:crypto'
import express from 'express'
import multer from 'multer'
import { config } from '../config.js'
import { tmpDir } from '../lib/storage.js'
import * as content from '../services/content.js'
import * as greetings from '../services/greetings.js'
import * as photos from '../services/photos.js'
import * as rsvp from '../services/rsvp.js'

const MB = 1024 * 1024

/** Small images held in memory (site hero/story pictures). */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploads.maxFileMb * MB, files: 1, fields: 10, fieldSize: 4096, parts: 12 },
})

/**
 * Photos / GIFs / videos are streamed to a private temp folder (never served)
 * under random names, validated, then moved into place. Per-type size limits
 * are enforced after the real type has been detected; this is the hard cap.
 * Fields: `photo` (the media file) and optional `poster` (video preview image).
 */
export const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpDir()),
    filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.upload`),
  }),
  limits: {
    fileSize: Math.max(config.uploads.maxFileMb, config.uploads.maxGifMb, config.uploads.maxVideoMb) * MB,
    files: 2,
    fields: 12,
    fieldSize: 4096,
    parts: 16,
  },
}).fields([
  { name: 'photo', maxCount: 1 },
  { name: 'poster', maxCount: 1 },
])

export default function createPublicRoutes({ db }) {
  const router = express.Router()

  router.get('/site', async (_req, res) => {
    res.json({ success: true, ...(await content.getPublicSite(db)) })
  })

  router.get('/photos', async (req, res) => {
    res.json({ success: true, photos: await photos.listApproved(db, req.query.limit) })
  })

  router.get('/greetings', async (req, res) => {
    res.json({ success: true, ...(await greetings.listApproved(db, req.query.page, req.query.limit)) })
  })

  router.post('/greetings', async (req, res) => {
    res.status(201).json({ success: true, ...(await greetings.submit(db, req.body ?? {}, req.ip)) })
  })

  router.get('/invitations/:token', async (req, res) => {
    res.json({ success: true, invitation: await rsvp.getInvitation(db, req.params.token, req.ip) })
  })

  router.post('/rsvps', async (req, res) => {
    res.status(201).json({ success: true, ...(await rsvp.submit(db, req.body ?? {}, req.ip)) })
  })

  router.post('/photos', mediaUpload, async (req, res) => {
    res.status(201).json({ success: true, ...(await photos.guestUpload(db, req.files, req.body ?? {}, req.ip)) })
  })

  return router
}
