// Unit tests (node --test). The official details are typed out again here, from
// the supplied invitation text, so any change to weddingData.js that alters a
// name, the order, the date, the venue or the programme fails a test.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { weddingData } from '../src/data/weddingData.js'
import { icsContent } from '../src/lib/calendar.js'
import { calendarEvent, coupleMonogram, coupleShort, mapsLink, venueAddress } from '../src/lib/content.js'
import { countdownParts, formatDate, isoDate, zonedInstant } from '../src/lib/time.js'

const PIHAK_LELAKI = [
  'YM Haji Abdul Hamid bin Haji Kalong',
  'YM Hjh Siti Ara bte Md Tahir',
  'YM Matzin bin Sumil',
  'YM Mariam bte Haji Duraman',
  'YM Md Haris Fadzillah bin Haji Abdul Hamid',
  'YM Norina bte Sumil',
  'YM Haji Zairi bin Sumil @Johari dan Isteri',
  'YM Nor Zetty Akhtar bte Haji Abdul Hamid dan Suami',
  'YM ISNA Putra Md Nursafwan Izzuddin bin Md Haris Fadzillah dan Isteri',
  'YM ISNA Puteri Intan Nur Shakinah bte Md Haris Fadzillah',
  'YM ISNA Putra Md Nurnajwan Azinuddin bin Md Haris Fadzillah',
]
const PIHAK_PEREMPUAN = [
  'YM Abdul Latiff bin Haji Abdul Wahab',
  'YM Sarimah binti Awang Zainal',
  'YM Md Syafiq bin Abdul Latiff',
  'YM Nur` Afina binti Haji Marsidi',
  'YM Nur Md Hafizuddin bin Aman',
  'YM Anna Syarina binti Abdul Latiff',
]
const ADDRESS = "Level 3, Aman Hills Hotel, Aman Hills Shopping Centre, Spg 30, Jalan Aman, Kg Manggis, Mukim Berakas 'B', Brunei-Muara, BC3615 Bandar Seri Begawan, Brunei Darussalam."

test('family lists: all 17 entries, exact spelling and order', () => {
  const [lelaki, perempuan] = weddingData.families
  assert.equal(lelaki.title, 'Pihak Lelaki')
  assert.equal(perempuan.title, 'Pihak Perempuan')
  assert.deepEqual(lelaki.members, PIHAK_LELAKI)
  assert.deepEqual(perempuan.members, PIHAK_PEREMPUAN)
  assert.equal(lelaki.members.length + perempuan.members.length, 17)
  assert.equal(weddingData.families.length, 2, 'no extra family groups')
})

test('event title, day, date and Hijri date are exactly as supplied', () => {
  const e = weddingData.event
  assert.equal(e.title, 'MAJLIS MENGHANTAR BERIAN, AKAD NIKAH & BERSANDING')
  assert.equal(e.titleLines.join(', '), e.title)
  assert.equal(e.day, 'Jumaat')
  assert.equal(e.dateText, '22 Januari 2027')
  assert.equal(e.hijriDate, '14 Syaaban 1448H')
  assert.equal(e.date, '2027-01-22')
  // The ISO date really is that weekday and date in Malay.
  assert.equal(formatDate(e.date, 'ms-BN'), `${e.day}, ${e.dateText}`)
  assert.equal(e.timeZone, 'Asia/Brunei')
})

test('venue name and address are exactly as supplied', () => {
  assert.equal(weddingData.venue.name, 'DAMAI BALLROOM AMAN HILLS')
  assert.equal(venueAddress(weddingData.venue), ADDRESS)
  const link = mapsLink(weddingData.venue)
  assert.ok(link.startsWith('https://www.google.com/maps/search/?api=1&query='), 'directions link needs no API key')
  assert.equal(decodeURIComponent(link.split('query=')[1]), `DAMAI BALLROOM AMAN HILLS, ${ADDRESS}`)
})

test('programme: confirmed times only, in order, in Bahasa Melayu', () => {
  assert.deepEqual(
    weddingData.programme.map((p) => [p.when, p.title]),
    [
      ['2:00 PM – 2:30 PM', 'Menerima Jemputan'],
      ['2:30 PM', 'Majlis Menghantar Berian & Akad Nikah'],
      ['Seterusnya', 'Majlis Bersanding'],
      ['Diikuti Dengan', 'Bacaan Doa Selamat dan Seterusnya Menikmati Jamuan'],
    ],
  )
})

test('countdown targets 22 Jan 2027, 2:00 PM Brunei time (06:00 UTC)', () => {
  const e = weddingData.event
  const target = zonedInstant(e.date, e.startTime, e.timeZone)
  assert.equal(target.toISOString(), '2027-01-22T06:00:00.000Z')
  assert.equal(countdownParts(target, Date.parse('2027-01-21T06:00:00Z')).days, 1)
  assert.equal(countdownParts(target, Date.parse('2027-01-22T06:30:00Z')).done, true)
})

test('calendar entry starts at 2:00 PM and invents no end time', () => {
  const ics = icsContent(calendarEvent(weddingData.event, weddingData.venue, weddingData.couple), weddingData.event.timeZone)
  assert.match(ics, /DTSTART:20270122T060000Z/)
  assert.match(ics, /DTEND:20270122T060000Z/)
  assert.match(ics, /SUMMARY:Naqiuddin & Syafina · MAJLIS MENGHANTAR BERIAN\\, AKAD NIKAH & BERSANDING/)
  assert.match(ics, /DESCRIPTION:Md Nurzakwan Naqiuddin bin Md Haris Fadzillah & Norana Syafina binti Abdul Latiff\\n/)
})

test('bride and groom: official names exactly as supplied', () => {
  const { groom, bride } = weddingData.couple
  assert.equal(groom.role, 'Pengantin Lelaki')
  assert.equal(groom.fullName, 'Md Nurzakwan Naqiuddin bin Md Haris Fadzillah')
  assert.equal(bride.role, 'Pengantin Perempuan')
  assert.equal(bride.fullName, 'Norana Syafina binti Abdul Latiff')
  for (const p of [groom, bride]) {
    assert.ok(p.fullName.startsWith(p.name), `${p.name} is the start of the full name`)
    assert.ok(p.name.includes(p.short))
    assert.equal(p.initial, p.short[0])
  }
  assert.equal(coupleShort(weddingData.couple), 'Naqiuddin & Syafina')
  assert.equal(coupleMonogram(weddingData.couple), 'N & S')
})

test('no placeholder couple data or RSVP', () => {
  const json = JSON.stringify(weddingData)
  assert.ok(!('rsvp' in weddingData), 'RSVP has been removed')
  for (const placeholder of ['Hakim', 'Aisyah', 'Lorem', 'Zulfitri', 'Mariah']) assert.ok(!json.includes(placeholder), `unexpected "${placeholder}"`)
})

test('gallery is clearly marked as sample placeholders', () => {
  const { gallery } = weddingData
  assert.match(gallery.note, /contoh/i)
  assert.ok(gallery.photos.every((p) => p.src && /^Gambar contoh/.test(p.alt) && p.width > 0 && p.height > 0))
})

test('dates never shift across time zones', () => {
  assert.equal(isoDate('2027-01-22T00:00:00.000Z'), '2027-01-22')
  assert.equal(zonedInstant(null, '12:00', 'UTC'), null)
})
