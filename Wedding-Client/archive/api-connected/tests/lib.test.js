// Unit tests for the pure helpers (node --test). No browser or API needed.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parse, resolveApiBase } from '../src/lib/api.js'
import { icsContent } from '../src/lib/calendar.js'
import { coupleNames, deepMerge, familyGroups, instagramLink, mapEmbedUrl, mapsLink, monogram, programmeRows, setPath, siteTitle } from '../src/lib/content.js'
import { countdownParts, formatDate, formatTime, formatTimeRange, isoDate, isPastDeadline, zonedInstant } from '../src/lib/time.js'
import { checkMediaFile, mediaKind, validateRsvp, validateWish } from '../src/lib/validation.js'

test('resolveApiBase accepts an origin with or without the API path', () => {
  assert.equal(resolveApiBase(''), '/api/wedding')
  assert.equal(resolveApiBase('https://api.example.com/'), 'https://api.example.com/api/wedding')
  assert.equal(resolveApiBase('https://api.example.com/api'), 'https://api.example.com/api/wedding')
  assert.equal(resolveApiBase('https://api.example.com/api/wedding'), 'https://api.example.com/api/wedding')
})

test('parse only treats { success: true } as data', () => {
  assert.deepEqual(parse(200, '{"success":true,"x":1}'), { success: true, x: 1 })
  assert.throws(() => parse(200, '<!doctype html>'), { code: 'INVALID_RESPONSE' })
  assert.throws(() => parse(200, ''), { code: 'INVALID_RESPONSE' })
  assert.throws(() => parse(429, '{"success":false,"code":"RATE_LIMITED","message":"Slow down"}'), { code: 'RATE_LIMITED', message: 'Slow down' })
  assert.throws(() => parse(502, 'Bad gateway'), { code: 'UNREACHABLE' })
})

test('zonedInstant converts wall-clock time in a zone to UTC', () => {
  assert.equal(zonedInstant('2027-01-01', '13:30:00', 'Asia/Brunei').toISOString(), '2027-01-01T05:30:00.000Z')
  assert.equal(zonedInstant('2027-07-01', '12:00', 'Europe/London').toISOString(), '2027-07-01T11:00:00.000Z')
  assert.equal(zonedInstant(null, '12:00', 'UTC'), null)
})

test('isoDate and formatDate never shift the calendar day', () => {
  assert.equal(isoDate('2027-01-01T00:00:00.000Z'), '2027-01-01')
  assert.equal(formatDate('2027-01-01', 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), '1 January 2027')
  assert.equal(formatDate('', 'en-GB'), '')
})

test('countdownParts and deadlines', () => {
  const target = new Date('2027-01-02T00:00:00Z')
  assert.deepEqual(countdownParts(target, Date.parse('2027-01-01T22:58:30Z')), { done: false, days: 0, hours: 1, minutes: 1, seconds: 30 })
  assert.equal(countdownParts(target, Date.parse('2027-01-03T00:00:00Z')).done, true)
  // Deadline lasts until the end of that day in the wedding's zone (UTC+8).
  assert.equal(isPastDeadline('2026-12-01', 'Asia/Brunei', Date.parse('2026-12-01T15:00:00Z')), false)
  assert.equal(isPastDeadline('2026-12-01', 'Asia/Brunei', Date.parse('2026-12-01T16:01:00Z')), true)
  assert.equal(isPastDeadline(null, 'UTC'), false)
})

test('content helpers', () => {
  assert.deepEqual(deepMerge({ a: { b: 1, c: 2 }, l: [1] }, { a: { b: 3 }, l: [], x: null }), { a: { b: 3, c: 2 }, l: [] })
  assert.deepEqual(setPath({ a: { b: 1 } }, 'a.c.d', 2), { a: { b: 1, c: { d: 2 } } })
  assert.deepEqual(familyGroups({ familyGroups: [{ title: ' Bride ', members: 'A\nB / C\n\n' }, { title: 'Empty', members: '' }, 'junk'] }), [
    { title: 'Bride', lines: ['A', 'B', 'C'], blocks: [['A', 'B', 'C']] },
  ])
  assert.equal(coupleNames({ partnerOne: 'Ali', partnerTwo: 'Siti' }).joined, 'Ali & Siti')
  assert.equal(coupleNames({}).joined, '')
  assert.equal(siteTitle({ couple: {}, invitation: { heading: 'MAJLIS X' } }), 'MAJLIS X')
  assert.equal(siteTitle({ couple: {}, invitation: {} }, [{ title: 'Akad Nikah' }]), 'Akad Nikah')
  assert.equal(siteTitle({ couple: { partnerOne: 'Ali', partnerTwo: 'Siti' }, invitation: { heading: 'MAJLIS X' } }), 'Ali & Siti')
  assert.equal(monogram({ partnerOne: 'ali', partnerTwo: 'siti' }), 'AS')
  assert.equal(mapsLink({ maps_url: 'javascript:alert(1)', venue_name: 'Hall' }), 'https://www.google.com/maps/search/?api=1&query=Hall')
  assert.equal(mapsLink({}), '')
})

test('validation', () => {
  assert.deepEqual(validateWish({ name: 'A', message: 'Congratulations!' }), {})
  assert.ok(validateWish({ name: '', message: 'x' }).name)
  assert.ok(validateWish({ name: 'A', message: 'see http://a http://b http://c' }).message)
  assert.ok(validateRsvp({ name: 'A', email: 'bad' }, [{ attending: true }]).email)
  assert.ok(validateRsvp({ name: 'A' }, []).responses)
  assert.deepEqual(validateRsvp({ name: 'A', phone: '+673 123 4567' }, [{ attending: false }]), {})
  assert.equal(mediaKind({ name: 'IMG_1.HEIC', type: '' }), 'image')
  assert.equal(mediaKind({ name: 'clip.mov', type: 'video/quicktime' }), null)
  assert.match(checkMediaFile({ name: 'clip.mov', type: 'video/quicktime', size: 1 }), /MP4 or WebM/)
  assert.match(checkMediaFile({ name: 'page.html', type: 'text/html', size: 1 }), /Only photos/)
  assert.match(checkMediaFile({ name: 'big.jpg', type: 'image/jpeg', size: 31 * 1024 * 1024 }), /too large/)
})

test('ics escapes text and uses the wedding time zone', () => {
  const ics = icsContent({ id: 'e1', title: 'Majlis; Reception', event_date: '2027-01-01', start_time: '13:30:00', end_time: null, venue_name: 'Hall, A' }, 'Asia/Brunei')
  assert.match(ics, /DTSTART:20270101T053000Z/)
  assert.match(ics, /DTEND:20270101T083000Z/)
  assert.match(ics, /SUMMARY:Majlis\\; Reception/)
  assert.match(ics, /LOCATION:Hall\\, A/)
})

test('admin CSV cells are quoted and neutralise formulas', async () => {
  globalThis.window ??= { location: { origin: 'https://wedding.example' } }
  const { csvCell, slugify, inviteLink } = await import('../src/admin/lib.js')
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`)
  assert.equal(csvCell('+60123'), `"'+60123"`)
  assert.equal(csvCell(null), '""')
  assert.equal(slugify('Pré-Wedding Photos!'), 'pre-wedding-photos')
  assert.equal(inviteLink('abc'), 'https://wedding.example/rsvp/abc')
})

test('Malay invitation time style', () => {
  assert.equal(formatTime('13:15:00', 'ms-BN'), '1.15 Petang')
  assert.equal(formatTime('09:05', 'ms-BN'), '9.05 Pagi')
  assert.equal(formatTime('12:30', 'ms-BN'), '12.30 Tengah Hari')
  assert.equal(formatTime('20:00', 'ms-BN'), '8.00 Malam')
  assert.equal(formatTimeRange('13:15', '14:15', 'ms-BN'), '1.15 – 2.15 Petang')
  assert.equal(formatTimeRange('11:00', '13:00', 'ms-BN'), '11.00 Pagi – 1.00 Petang')
  assert.match(formatTime('13:15', 'en-GB'), /^1:15\s?pm$/i)
})

// The 22 January 2027 majlis, exactly as seeded in database/seeds/001_majlis_22_januari_2027.sql.
const majlis = {
  title: 'MAJLIS MENGHANTAR BERIAN, AKAD NIKAH & BERSANDING',
  programme: [
    { time: '13:15', endTime: '14:15', title: 'Menerima Jemputan' },
    { time: '14:15', endTime: '', title: 'Majlis Menghantar Berian & Akad Nikah' },
    { time: '14:15', endTime: '', title: 'Majlis Bersanding' },
    { time: '', endTime: '', title: 'Bacaan Doa Selamat dan seterusnya Menikmati Jamuan' },
  ],
}

test('programme rows read like the printed atur acara', () => {
  assert.deepEqual(programmeRows(majlis, 'ms-BN'), [
    { when: '1.15 – 2.15 Petang', title: 'Menerima Jemputan', highlight: false },
    { when: '2.15 Petang', title: 'Majlis Menghantar Berian & Akad Nikah', highlight: true },
    { when: '2.15 Petang onward', title: 'Majlis Bersanding', highlight: true },
    { when: 'Seterusnya', title: 'Bacaan Doa Selamat dan seterusnya Menikmati Jamuan', highlight: false },
  ])
  assert.deepEqual(programmeRows({ title: 'X', programme: [{ title: 'Only item' }, 'junk', { title: '  ' }] }, 'en-GB'), [{ when: '', title: 'Only item', highlight: false }])
})

test('family lists keep their groupings and exact names', () => {
  const members = 'YM Haji Abdul Hamid bin Haji Kalong\nYM Norina bte Sumil\n\nYM Haji Zairi bin Sumil @Johari dan ISTRI\n\nYM NUR` AFINA BINTI HAJI MARSIDI'
  const [g] = familyGroups({ familyGroups: [{ title: 'PIHAK LELAKI', members }] })
  assert.equal(g.title, 'PIHAK LELAKI')
  assert.deepEqual(g.blocks, [['YM Haji Abdul Hamid bin Haji Kalong', 'YM Norina bte Sumil'], ['YM Haji Zairi bin Sumil @Johari dan ISTRI'], ['YM NUR` AFINA BINTI HAJI MARSIDI']])
  assert.equal(g.lines.length, 4)
  assert.equal(formatDate('2027-01-22', 'ms-BN'), 'Jumaat, 22 Januari 2027')
})

test('instagram links accept handles or instagram.com URLs only', () => {
  assert.deepEqual(instagramLink('@ali.siti'), { href: 'https://www.instagram.com/ali.siti/', handle: '@ali.siti' })
  assert.deepEqual(instagramLink('https://instagram.com/alisiti/'), { href: 'https://instagram.com/alisiti/', handle: '@alisiti' })
  assert.equal(instagramLink('javascript:alert(1)'), null)
  assert.equal(instagramLink('https://evil.example/alisiti'), null)
  assert.equal(instagramLink(''), null)
})

test('map embed joins a multi-line address', () => {
  const url = mapEmbedUrl({ venue_name: 'DAMAI BALLROOM AMAN HILLS', address: "Level 3,\nSpg 30, Jalan Aman, Mukim Berakas 'B'," })
  assert.ok(url.startsWith('https://maps.google.com/maps?q='))
  assert.equal(decodeURIComponent(url.split('q=')[1].split('&')[0]), "DAMAI BALLROOM AMAN HILLS, Level 3,, Spg 30, Jalan Aman, Mukim Berakas 'B',")
  assert.equal(mapEmbedUrl({}), '')
})
