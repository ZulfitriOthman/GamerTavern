import { newId, sha256 } from '../lib/crypto.js'
import { badRequest, forbidden } from '../lib/errors.js'
import { cleanText, text } from '../lib/validate.js'
import { requireSettings } from './content.js'
import { enforce } from './rateLimit.js'

export const PAGE_SIZE = 12

/**
 * Newest published wishes first. `limit` (1–24, default 12) lets the homepage
 * request just the latest few; `page` pages through the rest in that size.
 */
export async function listApproved(db, page, limit) {
  const size = Math.max(1, Math.min(PAGE_SIZE * 2, Number.parseInt(limit, 10) || PAGE_SIZE))
  const p = Math.max(0, Math.min(1000, Number.parseInt(page, 10) || 0))
  const [rows] = await db.query(
    `SELECT id, name, relationship, message, created_at FROM wedding_greetings
      WHERE status = 'approved' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [size + 1, p * size],
  )
  return { items: rows.slice(0, size), hasMore: rows.length > size }
}

/**
 * Publishes a guest's wish IMMEDIATELY — there is no approval step.
 * New valid wishes are always stored as 'approved'; the status is decided here,
 * never taken from the request. The couple can still hide ('hidden' / 'spam')
 * or delete any wish afterwards from the dashboard.
 * Returns { status: 'published', item } or { status: 'duplicate' }.
 */
export async function submit(db, body, ip) {
  const settings = await requireSettings(db)
  if (!settings.greetings_enabled) throw forbidden('The guestbook is not accepting messages right now.')

  // Honeypot: bots that fill the hidden field get a normal-looking reply and nothing is stored.
  if (cleanText(body.website)) return { status: 'published' }

  const name = text(body.name, { field: 'your name', max: 80, required: true })
  const message = text(body.message, { field: 'a message', min: 2, max: 1000 })
  const relationship = text(body.relationship, { field: 'the relationship', max: 60 })
  // Anti-abuse (wishes go live instantly): no link spam, no keyboard-mash floods.
  if ((message.match(/https?:\/\/|www\./gi) ?? []).length > 2) throw badRequest('Please remove the links from your message.')
  if (/(.)\1{14,}/u.test(message) || /(.)\1{14,}/u.test(name)) throw badRequest('Please write your message without long runs of repeated characters.')

  await enforce(
    db,
    [
      ['greeting', ip, 5, 1800],
      ['greeting-day', ip, 20, 86400],
      ['greeting-global', 'all', 400, 3600],
    ],
    'You have sent several messages recently. Please try again a little later.',
  )

  const id = newId()
  const hash = sha256(`${name.toLowerCase()}|${message.toLowerCase().replace(/\s+/g, ' ')}`)
  try {
    await db.query(
      "INSERT INTO wedding_greetings (id, name, relationship, message, status, content_hash) VALUES (?, ?, ?, ?, 'approved', ?)",
      [id, name, relationship, message, hash],
    )
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return { status: 'duplicate' }
    throw error
  }
  const [rows] = await db.query('SELECT id, name, relationship, message, created_at FROM wedding_greetings WHERE id = ?', [id])
  console.log(`[wedding-api] wish published ${id}`)
  return { status: 'published', item: rows[0] }
}
