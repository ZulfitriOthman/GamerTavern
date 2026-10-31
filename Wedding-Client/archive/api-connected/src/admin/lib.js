// Small dashboard helpers.

export const siteUrl = () => String(import.meta.env?.VITE_SITE_URL || window.location.origin).replace(/\/+$/, '')

/** Personal RSVP link. This exact format is used by links already sent to guests. */
export const inviteLink = (token) => `${siteUrl()}/rsvp/${token}`

export const slugify = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

/** One CSV cell: quoted, and neutralised against spreadsheet formula injection. */
export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export function downloadCsv(filename, header, rows) {
  const text = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export const hhmm = (t) => (t ? String(t).slice(0, 5) : '')
export const num = (v) => Number(v) || 0

/** "Name, seats" per line → guests. Lines without a valid seat count use `fallbackSeats`. */
export function parseBulk(text, fallbackSeats = 2) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)[,;\t]\s*(\d{1,2})\s*$/)
      const seats = m ? Number(m[2]) : fallbackSeats
      return { name: (m ? m[1] : line).trim(), max_party_size: Math.min(20, Math.max(1, seats)) }
    })
    .filter((g) => g.name)
}
