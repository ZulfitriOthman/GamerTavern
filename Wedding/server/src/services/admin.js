// Admin data management: settings, events, guests, RSVPs, greetings, albums, stats.
// Every function here is only reachable through requireAdmin().
import { newId, randomToken, sha256 } from '../lib/crypto.js'
import { badRequest, conflict, notFound } from '../lib/errors.js'
import * as v from '../lib/validate.js'
import { withTransaction } from '../db.js'
import { getSettings, mapEvent } from './content.js'

// --- settings ----------------------------------------------------------------
export async function updateSettings(db, body) {
  const content = body.content
  if (!content || typeof content !== 'object' || Array.isArray(content)) throw badRequest('Invalid content.')
  const json = JSON.stringify(content)
  if (json.length > 250_000) throw badRequest('The website content is too large.')
  const values = [
    v.date(body.wedding_date, 'Wedding date'),
    v.time(body.wedding_time, 'Wedding time'),
    v.timezone(body.timezone),
    v.oneOf(body.rsvp_mode, ['open', 'invite_only', 'closed'], 'RSVP mode'),
    v.date(body.rsvp_deadline, 'RSVP deadline'),
    v.bool(body.greetings_enabled),
    v.bool(body.greetings_auto_approve),
    v.bool(body.photo_uploads_enabled),
    json,
  ]
  const [result] = await db.query(
    `UPDATE wedding_settings SET wedding_date = ?, wedding_time = ?, timezone = ?, rsvp_mode = ?, rsvp_deadline = ?,
       greetings_enabled = ?, greetings_auto_approve = ?, photo_uploads_enabled = ?, content = ? WHERE id = 1`,
    values,
  )
  if (!result.affectedRows) throw notFound('Settings row missing — run database/seeds/001_wedding_information.sql.')
  return getSettings(db)
}

// --- events ------------------------------------------------------------------
function eventValues(b) {
  const mapsUrl = v.cleanText(b.maps_url)
  if (mapsUrl && (!/^https:\/\//i.test(mapsUrl) || mapsUrl.length > 600)) throw badRequest('The map link must start with https://')
  const programme = Array.isArray(b.programme) ? b.programme : []
  if (programme.length > 40) throw badRequest('Too many programme items.')
  const cleanProgramme = programme
    .map((p) => ({
      time: v.time(p?.time, 'Programme time')?.slice(0, 5) ?? '',
      endTime: v.time(p?.endTime, 'Programme end time')?.slice(0, 5) ?? '',
      title: v.text(p?.title, { field: 'the programme item', max: 200 }),
    }))
    .filter((p) => p.title)
  return {
    title: v.text(b.title, { field: 'a title', max: 100, required: true }),
    description: v.text(b.description, { field: 'the description', max: 2000 }),
    event_date: v.date(b.event_date, 'Date'),
    start_time: v.time(b.start_time, 'Start time'),
    end_time: v.time(b.end_time, 'End time'),
    venue_name: v.text(b.venue_name, { field: 'the venue', max: 150 }),
    address: v.text(b.address, { field: 'the address', max: 300 }),
    maps_url: mapsUrl,
    dress_code: v.text(b.dress_code, { field: 'the dress code', max: 300 }),
    programme: JSON.stringify(cleanProgramme),
    rsvp_enabled: v.bool(b.rsvp_enabled),
    capacity: v.int(b.capacity, { field: 'Capacity', min: 1, max: 100000, nullable: true }),
    max_party_size: v.int(b.max_party_size, { field: 'Max guests per reply', min: 1, max: 20 }),
    is_published: v.bool(b.is_published),
    sort_order: v.int(b.sort_order ?? 0, { field: 'Display order', min: -1000000, max: 1000000 }),
  }
}

export async function listEvents(db) {
  const [rows] = await db.query('SELECT * FROM wedding_events ORDER BY sort_order, event_date, start_time')
  return rows.map(mapEvent)
}

export async function saveEvent(db, id, body) {
  const fields = eventValues(body)
  const cols = Object.keys(fields)
  if (id) {
    const [r] = await db.query(`UPDATE wedding_events SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...Object.values(fields), v.uuid(id)])
    if (!r.affectedRows) throw notFound('Event not found.')
  } else {
    id = newId()
    await db.query(`INSERT INTO wedding_events (id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`, [id, ...Object.values(fields)])
  }
  const [rows] = await db.query('SELECT * FROM wedding_events WHERE id = ?', [id])
  return mapEvent(rows[0])
}

export async function deleteEvent(db, id) {
  const [r] = await db.query('DELETE FROM wedding_events WHERE id = ?', [v.uuid(id)])
  if (!r.affectedRows) throw notFound('Event not found.')
}

// --- guests ------------------------------------------------------------------
function guestValues(b) {
  return {
    name: v.text(b.name, { field: 'a name', max: 120, required: true }),
    email: v.email(b.email),
    phone: v.phone(b.phone),
    max_party_size: v.int(b.max_party_size, { field: 'Seats', min: 1, max: 20 }),
    notes: v.text(b.notes, { field: 'the notes', max: 1000 }),
  }
}

const GUEST_SELECT = `SELECT g.id, g.name, g.email, g.phone, g.max_party_size, g.notes, g.created_at, g.updated_at,
  g.invite_created_at, (g.invite_token_hash IS NOT NULL) AS has_invite_link FROM wedding_guests g`

export async function listGuests(db) {
  const [guests] = await db.query(`${GUEST_SELECT} ORDER BY g.name`)
  const [replies] = await db.query('SELECT guest_id, event_id, attending, party_size FROM wedding_rsvps WHERE guest_id IS NOT NULL')
  const byGuest = new Map()
  for (const { guest_id: guestId, ...r } of replies) {
    if (!byGuest.has(guestId)) byGuest.set(guestId, [])
    byGuest.get(guestId).push(r)
  }
  return guests.map((g) => ({ ...g, has_invite_link: Boolean(Number(g.has_invite_link)), rsvp_responses: byGuest.get(g.id) ?? [] }))
}

/** Generates a new private link token. The plain token is returned once and never stored. */
async function issueToken(conn, guestId) {
  const token = randomToken(24)
  await conn.query('UPDATE wedding_guests SET invite_token_hash = ?, invite_created_at = UTC_TIMESTAMP() WHERE id = ?', [sha256(token), guestId])
  return token
}

export async function createGuests(db, list) {
  if (!Array.isArray(list) || list.length === 0 || list.length > 500) throw badRequest('Add between 1 and 500 guests at a time.')
  const rows = list.map(guestValues)
  return withTransaction(db, async (conn) => {
    const created = []
    for (const g of rows) {
      const id = newId()
      await conn.query('INSERT INTO wedding_guests (id, name, email, phone, max_party_size, notes) VALUES (?, ?, ?, ?, ?, ?)', [
        id,
        g.name,
        g.email,
        g.phone,
        g.max_party_size,
        g.notes,
      ])
      created.push({ id, name: g.name, token: await issueToken(conn, id) })
    }
    return created
  })
}

export async function updateGuest(db, id, body) {
  const g = guestValues(body)
  const [r] = await db.query('UPDATE wedding_guests SET name = ?, email = ?, phone = ?, max_party_size = ?, notes = ? WHERE id = ?', [
    g.name,
    g.email,
    g.phone,
    g.max_party_size,
    g.notes,
    v.uuid(id),
  ])
  if (!r.affectedRows) throw notFound('Guest not found.')
}

export async function regenerateInvite(db, id) {
  const [rows] = await db.query('SELECT id FROM wedding_guests WHERE id = ?', [v.uuid(id)])
  if (!rows[0]) throw notFound('Guest not found.')
  return { token: await issueToken(db, id) }
}

export async function deleteGuest(db, id) {
  const [r] = await db.query('DELETE FROM wedding_guests WHERE id = ?', [v.uuid(id)])
  if (!r.affectedRows) throw notFound('Guest not found.')
}

// --- RSVPs -------------------------------------------------------------------
// LEFT JOIN: replies whose event row is gone (e.g. removed with FK checks off)
// must still be listed — wedding_events is null for them.
export async function listRsvps(db) {
  const [rows] = await db.query(
    `SELECT r.*, e.id AS event_found, e.title AS event_title, g.name AS guest_name
       FROM wedding_rsvps r
       LEFT JOIN wedding_events e ON e.id = r.event_id
       LEFT JOIN wedding_guests g ON g.id = r.guest_id
      ORDER BY r.created_at DESC`,
  )
  return rows.map(({ dedupe_hash: _d, event_found, event_title, guest_name, ...r }) => ({
    ...r,
    wedding_events: event_found ? { title: event_title } : null,
    invited_guests: guest_name ? { name: guest_name } : null,
  }))
}

export async function updateRsvp(db, id, body) {
  const attending = v.bool(body.attending)
  const party = attending ? v.int(body.party_size, { field: 'Number of guests', min: 1, max: 20 }) : 0
  const name = v.text(body.name, { field: 'a name', max: 120, required: true })
  const message = v.text(body.message, { field: 'the message', max: 1000 })
  const [r] = await db.query('UPDATE wedding_rsvps SET attending = ?, party_size = ?, name = ?, message = ? WHERE id = ?', [
    attending,
    party,
    name,
    message,
    v.uuid(id),
  ])
  if (!r.affectedRows) throw notFound('RSVP not found.')
}

export async function deleteRsvp(db, id) {
  const [r] = await db.query('DELETE FROM wedding_rsvps WHERE id = ?', [v.uuid(id)])
  if (!r.affectedRows) throw notFound('RSVP not found.')
}

// --- greetings ---------------------------------------------------------------
const GREETING_STATUSES = ['pending', 'approved', 'hidden', 'spam']

export async function listGreetings(db, status) {
  const where = GREETING_STATUSES.includes(status) ? 'WHERE status = ?' : ''
  const [rows] = await db.query(
    `SELECT id, name, relationship, message, status, created_at, updated_at FROM wedding_greetings ${where} ORDER BY created_at DESC LIMIT 500`,
    where ? [status] : [],
  )
  return rows
}

export async function setGreetingStatus(db, id, status) {
  const [r] = await db.query('UPDATE wedding_greetings SET status = ? WHERE id = ?', [v.oneOf(status, GREETING_STATUSES, 'status'), v.uuid(id)])
  if (!r.affectedRows) throw notFound('Message not found.')
}

export async function deleteGreeting(db, id) {
  const [r] = await db.query('DELETE FROM wedding_greetings WHERE id = ?', [v.uuid(id)])
  if (!r.affectedRows) throw notFound('Message not found.')
}

// --- albums ------------------------------------------------------------------
export async function listAlbums(db) {
  const [rows] = await db.query('SELECT * FROM wedding_albums ORDER BY sort_order, title')
  return rows
}

export async function saveAlbum(db, id, b) {
  const fields = {
    title: v.text(b.title, { field: 'a title', max: 80, required: true }),
    description: v.text(b.description, { field: 'the description', max: 500 }),
    is_public: b.is_public === undefined ? true : v.bool(b.is_public),
    is_guest_uploads: v.bool(b.is_guest_uploads),
    sort_order: v.int(b.sort_order ?? 0, { field: 'Order', min: -1000000, max: 1000000 }),
  }
  return withTransaction(db, async (conn) => {
    // Only one album may receive guest uploads.
    if (fields.is_guest_uploads) await conn.query('UPDATE wedding_albums SET is_guest_uploads = 0 WHERE id <> ?', [id ?? ''])
    if (id) {
      const [r] = await conn.query('UPDATE wedding_albums SET title = ?, description = ?, is_public = ?, is_guest_uploads = ?, sort_order = ? WHERE id = ?', [
        ...Object.values(fields),
        v.uuid(id),
      ])
      if (!r.affectedRows) throw notFound('Album not found.')
    } else {
      const slug = v.cleanText(b.slug)
      if (!slug || !v.SLUG_RE.test(slug) || slug.length > 60) throw badRequest('Invalid album name.')
      id = newId()
      try {
        await conn.query(
          'INSERT INTO wedding_albums (id, slug, title, description, is_public, is_guest_uploads, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, slug, ...Object.values(fields)],
        )
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') throw conflict('An album with that name already exists.')
        throw error
      }
    }
    const [rows] = await conn.query('SELECT * FROM wedding_albums WHERE id = ?', [id])
    return rows[0]
  })
}

export async function deleteAlbum(db, id) {
  const [r] = await db.query('DELETE FROM wedding_albums WHERE id = ?', [v.uuid(id)])
  if (!r.affectedRows) throw notFound('Album not found.')
}

// --- stats -------------------------------------------------------------------
export async function stats(db) {
  const [[s]] = await db.query(`SELECT
      (SELECT COUNT(*) FROM wedding_guests) AS invited_parties,
      (SELECT COALESCE(SUM(max_party_size), 0) FROM wedding_guests) AS invited_seats,
      (SELECT COUNT(DISTINCT dedupe_hash) FROM wedding_rsvps) AS responding_parties,
      (SELECT COUNT(*) FROM wedding_rsvps) AS responses,
      (SELECT COUNT(*) FROM wedding_rsvps WHERE attending = 1) AS attending_responses,
      (SELECT COUNT(*) FROM wedding_rsvps WHERE attending = 0) AS declined_responses,
      (SELECT COALESCE(SUM(party_size), 0) FROM wedding_rsvps WHERE attending = 1) AS expected_attendees,
      (SELECT COUNT(*) FROM wedding_greetings WHERE status = 'pending') AS pending_greetings,
      (SELECT COUNT(*) FROM wedding_photos WHERE status = 'pending') AS pending_photos`)
  const [events] = await db.query(`SELECT e.id, e.title, e.event_date, e.capacity,
      COALESCE(SUM(CASE WHEN r.attending = 1 THEN r.party_size END), 0) AS attending,
      COUNT(CASE WHEN r.attending = 0 THEN 1 END) AS declined,
      COUNT(r.id) AS responses
    FROM wedding_events e LEFT JOIN wedding_rsvps r ON r.event_id = e.id
    GROUP BY e.id, e.title, e.event_date, e.capacity, e.sort_order
    ORDER BY e.sort_order, e.event_date`)
  const num = (o) => Object.fromEntries(Object.entries(o).map(([k, val]) => [k, typeof val === 'string' && /^\d+$/.test(val) ? Number(val) : val]))
  return { ...num(s), events: events.map(num) }
}
