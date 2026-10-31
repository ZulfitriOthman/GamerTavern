// Guest RSVP flows. Replaces the Supabase submit_rsvp / get_invitation
// functions with the same rules:
//  * personal links (token) update the party's own replies in place
//  * open RSVPs can never overwrite an existing reply ('duplicate')
//  * party-size limits, event capacity (row-locked), RSVP mode and deadline
import { INVITE_TOKEN_RE, newId, sha256 } from '../lib/crypto.js'
import { AppError, badRequest, forbidden, notFound } from '../lib/errors.js'
import { isPastDeadline } from '../lib/time.js'
import { cleanText, email as validEmail, phone as validPhone, text, UUID_RE } from '../lib/validate.js'
import { withTransaction } from '../db.js'
import { requireSettings } from './content.js'
import { enforce } from './rateLimit.js'

async function findGuestByToken(db, token) {
  if (typeof token !== 'string' || !INVITE_TOKEN_RE.test(token)) return null
  const [rows] = await db.query('SELECT id, name, email, phone, max_party_size FROM wedding_guests WHERE invite_token_hash = ?', [sha256(token)])
  return rows[0] ?? null
}

export async function getInvitation(db, token, ip) {
  await enforce(db, [['invite-lookup', ip, 40, 600]], 'Too many attempts. Please wait a few minutes and try again.')
  const guest = await findGuestByToken(db, token)
  if (!guest) throw notFound('This invitation link is not valid. Please check the link or contact the couple.')
  const [responses] = await db.query(
    'SELECT event_id, attending, party_size, message, updated_at FROM wedding_rsvps WHERE guest_id = ?',
    [guest.id],
  )
  return {
    name: guest.name,
    email: guest.email,
    phone: guest.phone,
    max_party_size: guest.max_party_size,
    responses,
  }
}

function dedupeKey({ guest, email, phone, name }) {
  if (guest) return `guest:${guest.id}`
  if (email) return `email:${email}`
  if (phone) return `phone:${phone.replace(/\D/g, '')}`
  return `name:${name.toLowerCase().replace(/\s+/g, ' ')}`
}

function parseResponses(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) throw badRequest('Please choose at least one event.')
  const seen = new Set()
  return raw.map((r) => {
    const eventId = typeof r?.event_id === 'string' ? r.event_id.toLowerCase() : ''
    if (!UUID_RE.test(eventId) || seen.has(eventId) || typeof r.attending !== 'boolean') {
      throw badRequest('Your RSVP contained an invalid choice. Please refresh and try again.')
    }
    seen.add(eventId)
    const party = r.attending ? Number(r.party_size) : 0
    if (r.attending && !Number.isInteger(party)) throw badRequest('Please choose a valid number of guests.')
    return { eventId, attending: r.attending, party }
  })
}

/** Returns { status: 'saved' | 'duplicate', events }. */
export async function submit(db, body, ip) {
  const settings = await requireSettings(db)
  if (settings.rsvp_mode === 'closed') throw forbidden('RSVPs are currently closed.')
  if (isPastDeadline(settings.rsvp_deadline, settings.timezone)) {
    throw forbidden('The RSVP deadline has passed. Please contact the couple directly.')
  }
  if (cleanText(body.website)) return { status: 'saved', events: 0 }

  await enforce(
    db,
    [
      ['rsvp', ip, 10, 900],
      ['rsvp-global', 'all', 600, 3600],
    ],
    'Too many RSVP attempts. Please wait a few minutes and try again.',
  )

  let guest = null
  if (cleanText(body.token)) {
    guest = await findGuestByToken(db, cleanText(body.token))
    if (!guest) throw badRequest('This invitation link is not valid. Please check the link or contact the couple.', 'INVALID_TOKEN')
  } else if (settings.rsvp_mode === 'invite_only') {
    throw forbidden('Please use the personal RSVP link from your invitation.')
  }

  const name = text(body.name ?? guest?.name, { field: 'your name', max: 120, required: true })
  const email = validEmail(body.email)
  const phone = validPhone(body.phone)
  const message = text(body.message, { field: 'your message', max: 1000 })
  const responses = parseResponses(body.responses)
  const dedupeHash = sha256(dedupeKey({ guest, email, phone, name }))
  const source = guest ? 'invite' : 'open'

  return withTransaction(db, async (conn) => {
    // Open RSVPs never overwrite an existing reply for the same person.
    if (!guest) {
      const [dups] = await conn.query(
        `SELECT 1 FROM wedding_rsvps WHERE dedupe_hash = ? AND event_id IN (${responses.map(() => '?').join(',')}) LIMIT 1`,
        [dedupeHash, ...responses.map((r) => r.eventId)],
      )
      if (dups.length) return { status: 'duplicate' }
    }

    // Lock the chosen events (in a consistent order) so capacity checks are serialised.
    const ids = responses.map((r) => r.eventId).sort()
    const [events] = await conn.query(
      `SELECT id, title, is_published, rsvp_enabled, capacity, max_party_size
         FROM wedding_events WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY id FOR UPDATE`,
      ids,
    )
    const byId = new Map(events.map((e) => [e.id, e]))

    for (const r of responses) {
      const event = byId.get(r.eventId)
      if (!event || !event.is_published || !event.rsvp_enabled) throw badRequest('One of the selected events is not accepting RSVPs.')
      if (r.attending) {
        const limit = Math.min(event.max_party_size, guest?.max_party_size ?? event.max_party_size)
        if (r.party < 1 || r.party > limit) throw badRequest(`For ${event.title}, you can reply for up to ${limit} guest(s).`)
        if (event.capacity !== null) {
          const [[{ taken }]] = await conn.query(
            'SELECT COALESCE(SUM(party_size), 0) AS taken FROM wedding_rsvps WHERE event_id = ? AND attending = 1 AND dedupe_hash <> ?',
            [event.id, dedupeHash],
          )
          if (Number(taken) + r.party > event.capacity) {
            throw new AppError(409, 'EVENT_FULL', `Sorry, ${event.title} has reached its guest capacity. Please contact the couple.`)
          }
        }
      }
    }

    for (const r of responses) {
      const values = [newId(), r.eventId, guest?.id ?? null, name, email, phone, r.attending, r.party, message, dedupeHash, source]
      const insert = `INSERT INTO wedding_rsvps (id, event_id, guest_id, name, email, phone, attending, party_size, message, dedupe_hash, source)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      if (guest) {
        await conn.query(
          `${insert} ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), phone = VALUES(phone),
             attending = VALUES(attending), party_size = VALUES(party_size), message = VALUES(message)`,
          values,
        )
      } else {
        try {
          await conn.query(insert, values)
        } catch (error) {
          if (error.code === 'ER_DUP_ENTRY') throw new AppError(409, 'DUPLICATE', 'duplicate')
          throw error
        }
      }
    }
    return { status: 'saved', events: responses.length }
  }).catch((error) => {
    // A concurrent duplicate open RSVP: report it the same way as the pre-check.
    if (error.code === 'DUPLICATE') return { status: 'duplicate' }
    throw error
  })
}
