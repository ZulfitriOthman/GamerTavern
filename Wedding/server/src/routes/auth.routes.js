import express from 'express'
import { config } from '../config.js'
import * as auth from '../services/auth.js'

export default function createAuthRoutes({ db }) {
  const router = express.Router()

  router.post('/login', async (req, res) => {
    const result = await auth.login(db, req.body ?? {}, { ip: req.ip, userAgent: req.get('user-agent') })
    res.cookie(config.session.cookieName, result.token, auth.cookieOptions())
    res.json({ success: true, admin: result.admin, csrfToken: result.csrf })
  })

  router.post('/logout', async (req, res) => {
    await auth.logout(db, req)
    const { maxAge: _m, ...opts } = auth.cookieOptions()
    res.clearCookie(config.session.cookieName, opts)
    res.json({ success: true })
  })

  // Lets the dashboard restore a session after reload and obtain its CSRF token.
  router.get('/session', async (req, res) => {
    const s = await auth.loadSession(db, req)
    if (!s) return res.json({ success: true, admin: null })
    res.json({ success: true, admin: { id: s.id, email: s.email, displayName: s.display_name }, csrfToken: s.csrf_token })
  })

  return router
}
