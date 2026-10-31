import { notFound } from '../lib/errors.js'
import { parseJson } from '../lib/validate.js'

export const SETTINGS_COLUMNS = [
  'wedding_date',
  'wedding_time',
  'timezone',
  'rsvp_mode',
  'rsvp_deadline',
  'greetings_enabled',
  'greetings_auto_approve',
  'photo_uploads_enabled',
]

export function mapSettings(row) {
  if (!row) return null
  const out = { id: row.id, content: parseJson(row.content, {}), updated_at: row.updated_at }
  for (const c of SETTINGS_COLUMNS) out[c] = row[c]
  return out
}

export function mapEvent(row) {
  return { ...row, programme: parseJson(row.programme, []) }
}

export async function getSettings(db, conn = db) {
  const [rows] = await conn.query('SELECT * FROM wedding_settings WHERE id = 1')
  return mapSettings(rows[0])
}

export async function requireSettings(db, conn = db) {
  const s = await getSettings(db, conn)
  if (!s) throw notFound('The website has not been set up yet.')
  return s
}

const EVENT_COLUMNS = `id, title, description, event_date, start_time, end_time, venue_name, address, maps_url,
  dress_code, programme, rsvp_enabled, capacity, max_party_size, is_published, sort_order`

export async function getPublicSite(db) {
  const [[settingsRows], [eventRows], [albumRows]] = await Promise.all([
    db.query('SELECT * FROM wedding_settings WHERE id = 1'),
    db.query(`SELECT ${EVENT_COLUMNS} FROM wedding_events WHERE is_published = 1 ORDER BY sort_order, event_date, start_time`),
    db.query('SELECT id, slug, title, description, sort_order, is_guest_uploads FROM wedding_albums WHERE is_public = 1 ORDER BY sort_order'),
  ])
  return {
    settings: mapSettings(settingsRows[0]),
    events: eventRows.map(mapEvent),
    albums: albumRows,
  }
}
