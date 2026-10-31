// Pure helpers for the content model (shared by the site and the dashboard).
import { formatTime, formatTimeRange } from './time.js'

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Deep-merges `override` onto `base`. Arrays and primitives in `override` replace base values. */
export function deepMerge(base, override) {
  if (!isPlainObject(override)) return base
  const out = { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined || value === null) continue
    out[key] = isPlainObject(value) && isPlainObject(base?.[key]) ? deepMerge(base[key], value) : value
  }
  return out
}

/** Immutable set of a dotted path: setPath(obj, 'a.b.c', 1). */
export function setPath(obj, path, value) {
  const [head, ...rest] = path.split('.')
  return { ...obj, [head]: rest.length ? setPath(obj?.[head] ?? {}, rest.join('.'), value) : value }
}

const str = (v) => (typeof v === 'string' ? v : '')

/**
 * Family groups with at least one name. One name per line ("/" also breaks a
 * line); a blank line starts a new block, so households stay together.
 * → [{ title, lines: [...all names], blocks: [[names], [names]] }]
 */
export function familyGroups(invitation) {
  if (!Array.isArray(invitation?.familyGroups)) return []
  return invitation.familyGroups
    .filter(isPlainObject)
    .map((g) => {
      const blocks = str(g.members)
        .split(/\r?\n\s*\r?\n/)
        .map((block) => block.split(/\r?\n|\//).map((l) => l.trim()).filter(Boolean))
        .filter((block) => block.length > 0)
      return { title: str(g.title).trim(), lines: blocks.flat(), blocks }
    })
    .filter((g) => g.lines.length > 0)
}

export function coupleNames(couple) {
  const a = str(couple?.partnerOne).trim()
  const b = str(couple?.partnerTwo).trim()
  return { a, b, joined: a && b ? `${a} & ${b}` : a || b || '' }
}

/**
 * The site's display title: the couple's names when set, otherwise the
 * invitation heading or the first event's title — never invented text.
 */
export function siteTitle(content, events = []) {
  return coupleNames(content?.couple).joined || str(content?.invitation?.heading).trim() || str(events[0]?.title).trim() || 'Wedding'
}

/**
 * Programme rows ready to display:
 *   start + end                 → "1.15 – 2.15 Petang"
 *   same start as the item above → "2.15 Petang onward" (it follows straight on)
 *   no time, after timed items  → "Seterusnya" / "Then"
 * `highlight` marks the ceremonies named in the event title
 * (e.g. "Akad Nikah", "Bersanding"), so the main moments stand out.
 */
export function programmeRows(event, locale) {
  const items = (Array.isArray(event?.programme) ? event.programme : []).filter((p) => isPlainObject(p) && str(p.title).trim())
  const malay = /^ms\b/i.test(locale || '')
  const keyParts = str(event?.title)
    .toLowerCase()
    .split(/[,&]| dan /)
    .map((s) => s.trim())
    .filter((s) => s.length >= 5)
  let sawTime = false
  return items.map((p, i) => {
    const title = str(p.title).trim()
    let when = ''
    if (p.time) {
      const sameAsPrevious = i > 0 && items[i - 1].time === p.time && !p.endTime
      when = sameAsPrevious ? `${formatTime(p.time, locale)} onward` : formatTimeRange(p.time, p.endTime, locale)
      sawTime = true
    } else if (sawTime) {
      when = malay ? 'Seterusnya' : 'Then'
    }
    const lower = title.toLowerCase()
    return { when, title, highlight: keyParts.some((k) => lower.includes(k)) }
  })
}

export function monogram(couple) {
  const m = str(couple?.monogram).trim()
  if (m) return m.slice(0, 4)
  const { a, b } = coupleNames(couple)
  return `${a.charAt(0)}${b.charAt(0)}`.toUpperCase() || '♥'
}

/** Google Maps link: the event's own link, else a search for venue + address. */
export function mapsLink(event) {
  if (event?.maps_url && /^https:\/\//i.test(event.maps_url)) return event.maps_url
  const q = [event?.venue_name, event?.address].filter(Boolean).join(', ')
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : ''
}

/** Accepts "@handle", "handle" or an https:// Instagram URL. */
export function instagramLink(value) {
  const v = String(value ?? '').trim()
  if (!v) return null
  if (/^https:\/\/(www\.)?instagram\.com\/[\w.]+\/?$/i.test(v)) return { href: v, handle: `@${v.replace(/\/$/, '').split('/').pop()}` }
  const handle = v.replace(/^@/, '')
  return /^[\w.]{1,30}$/.test(handle) ? { href: `https://www.instagram.com/${handle}/`, handle: `@${handle}` } : null
}

/** Keyless Google Maps embed for an event's venue (loaded only when a guest asks). */
export const mapEmbedUrl = (event) => {
  const q = [event?.venue_name, event?.address].filter(Boolean).join(', ').replace(/\s*\n\s*/g, ', ')
  return q ? `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed` : ''
}
