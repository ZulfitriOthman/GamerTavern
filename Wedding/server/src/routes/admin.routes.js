// Admin endpoints. Every route requires a valid admin session; every
// state-changing route also requires the session's X-CSRF-Token header.
import express from 'express'
import * as admin from '../services/admin.js'
import { requireAdmin } from '../services/auth.js'
import * as content from '../services/content.js'
import * as photos from '../services/photos.js'
import { imageUpload, mediaUpload } from './public.routes.js'

export default function createAdminRoutes({ db }) {
  const router = express.Router()
  router.use(requireAdmin(db))
  const ok = (res, data = {}, status = 200) => res.status(status).json({ success: true, ...data })

  router.get('/stats', async (_req, res) => ok(res, { stats: await admin.stats(db) }))

  router.get('/settings', async (_req, res) => ok(res, { settings: await content.getSettings(db) }))
  router.put('/settings', async (req, res) => ok(res, { settings: await admin.updateSettings(db, req.body ?? {}) }))
  router.post('/assets', imageUpload.single('image'), async (req, res) => ok(res, await photos.uploadSiteAsset(req.file), 201))

  router.get('/events', async (_req, res) => ok(res, { events: await admin.listEvents(db) }))
  router.post('/events', async (req, res) => ok(res, { event: await admin.saveEvent(db, null, req.body ?? {}) }, 201))
  router.put('/events/:id', async (req, res) => ok(res, { event: await admin.saveEvent(db, req.params.id, req.body ?? {}) }))
  router.delete('/events/:id', async (req, res) => ok(res, await admin.deleteEvent(db, req.params.id)))

  router.get('/guests', async (_req, res) => ok(res, { guests: await admin.listGuests(db) }))
  router.post('/guests', async (req, res) => ok(res, { created: await admin.createGuests(db, req.body?.guests) }, 201))
  router.put('/guests/:id', async (req, res) => ok(res, await admin.updateGuest(db, req.params.id, req.body ?? {})))
  router.post('/guests/:id/invite-link', async (req, res) => ok(res, await admin.regenerateInvite(db, req.params.id)))
  router.delete('/guests/:id', async (req, res) => ok(res, await admin.deleteGuest(db, req.params.id)))

  router.get('/rsvps', async (_req, res) => ok(res, { rsvps: await admin.listRsvps(db) }))
  router.put('/rsvps/:id', async (req, res) => ok(res, await admin.updateRsvp(db, req.params.id, req.body ?? {})))
  router.delete('/rsvps/:id', async (req, res) => ok(res, await admin.deleteRsvp(db, req.params.id)))

  router.get('/greetings', async (req, res) => ok(res, { greetings: await admin.listGreetings(db, req.query.status) }))
  router.patch('/greetings/:id', async (req, res) => ok(res, await admin.setGreetingStatus(db, req.params.id, req.body?.status)))
  router.delete('/greetings/:id', async (req, res) => ok(res, await admin.deleteGreeting(db, req.params.id)))

  router.get('/albums', async (_req, res) => ok(res, { albums: await admin.listAlbums(db) }))
  router.post('/albums', async (req, res) => ok(res, { album: await admin.saveAlbum(db, null, req.body ?? {}) }, 201))
  router.put('/albums/:id', async (req, res) => ok(res, { album: await admin.saveAlbum(db, req.params.id, req.body ?? {}) }))
  router.delete('/albums/:id', async (req, res) => ok(res, await admin.deleteAlbum(db, req.params.id)))

  router.get('/photos', async (req, res) => ok(res, { photos: await photos.listForAdmin(db, req.query.status) }))
  router.post('/photos', mediaUpload, async (req, res) => ok(res, { photo: await photos.officialUpload(db, req.files, req.body ?? {}) }, 201))
  router.patch('/photos/:id', async (req, res) => ok(res, await photos.updatePhoto(db, req.params.id, req.body ?? {})))
  router.delete('/photos/:id', async (req, res) => ok(res, await photos.deletePhoto(db, req.params.id)))

  return router
}
