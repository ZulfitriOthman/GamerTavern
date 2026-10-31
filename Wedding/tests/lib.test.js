import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildIcs, eventInstants, mapsLink } from '../src/lib/calendar.js'
import { toCsv } from '../src/lib/csv.js'
import { deepMerge } from '../src/lib/merge.js'
import { countdownParts, formatDate, formatTime, isPastDeadline, zonedTimeToUtc } from '../src/lib/time.js'
import { checkImageFile, validateGreeting, validateRsvp, validateUploadMeta } from '../src/lib/validation.js'

describe('time', () => {
  it('converts wall-clock time in a zone to UTC', () => {
    assert.equal(zonedTimeToUtc('2027-06-12', '10:30', 'Asia/Kuala_Lumpur').toISOString(), '2027-06-12T02:30:00.000Z')
    assert.equal(zonedTimeToUtc('2027-01-15', '09:00', 'Europe/London').toISOString(), '2027-01-15T09:00:00.000Z')
    assert.equal(zonedTimeToUtc('2027-07-15', '09:00', 'Europe/London').toISOString(), '2027-07-15T08:00:00.000Z')
  })
  it('handles missing or invalid input', () => {
    assert.equal(zonedTimeToUtc(null, '10:00', 'UTC'), null)
    assert.equal(zonedTimeToUtc('not-a-date'), null)
    assert.equal(zonedTimeToUtc('2027-01-01', '10:00', 'Not/AZone').toISOString(), '2027-01-01T10:00:00.000Z')
  })
  it('formats dates without shifting the day', () => {
    assert.match(formatDate('2027-06-12', 'en-GB'), /^Saturday,? 12 June 2027$/)
    assert.equal(formatDate(''), '')
    assert.match(formatTime('14:05:00', 'en-GB'), /2:05\s?pm/i)
  })
  it('computes countdown parts', () => {
    assert.deepEqual(countdownParts(90061000), { days: 1, hours: 1, minutes: 1, seconds: 1 })
    assert.deepEqual(countdownParts(-5), { days: 0, hours: 0, minutes: 0, seconds: 0 })
  })
  it('treats the RSVP deadline as inclusive of the whole day', () => {
    const tz = 'Asia/Kuala_Lumpur'
    assert.equal(isPastDeadline('2027-05-01', tz, new Date('2027-05-01T15:00:00Z')), false) // 23:00 local
    assert.equal(isPastDeadline('2027-05-01', tz, new Date('2027-05-01T16:30:00Z')), true) // 00:30 next day
    assert.equal(isPastDeadline(null, tz), false)
  })
})

describe('calendar', () => {
  const event = { id: 'e1', title: 'Reception', event_date: '2027-06-12', start_time: '19:00', end_time: null, venue_name: 'Hall', address: '1 Road, City' }
  it('defaults to a 3 hour slot', () => {
    const [s, e] = eventInstants(event, 'UTC')
    assert.equal((e - s) / 3600000, 3)
  })
  it('builds a valid ICS file with escaped text', () => {
    const ics = buildIcs(event, 'UTC', 'A & B', new Date('2027-01-01T00:00:00Z'))
    assert.match(ics, /DTSTART:20270612T190000Z/)
    assert.match(ics, /LOCATION:Hall\\, 1 Road\\, City/)
  })
  it('generates map links', () => {
    assert.equal(mapsLink({ maps_url: 'https://x.test' }), 'https://x.test')
    assert.match(mapsLink(event), /query=Hall%2C%201%20Road%2C%20City/)
    assert.equal(mapsLink({}), '')
  })
})

describe('csv', () => {
  it('escapes quotes, commas and neutralises formulas', () => {
    const csv = toCsv([{ a: '=HYPERLINK("x")', b: 'Hello, "world"' }], [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B' },
    ])
    assert.equal(csv, 'A,B\r\n"\'=HYPERLINK(""x"")","Hello, ""world"""')
  })
})

describe('merge', () => {
  it('deep merges objects and replaces arrays', () => {
    const out = deepMerge({ a: { b: 1, c: 2 }, list: [1, 2] }, { a: { c: 3 }, list: [9] })
    assert.deepEqual(out, { a: { b: 1, c: 3 }, list: [9] })
  })
})

describe('validation', () => {
  it('validates greetings', () => {
    assert.ok(validateGreeting({ name: '', message: 'x' }).errors.name)
    assert.ok(validateGreeting({ name: 'A', message: 'x' }).errors.message)
    const ok = validateGreeting({ name: '  Sam \u0007', message: ' Congratulations! ', relationship: '' })
    assert.deepEqual(ok.errors, {})
    assert.deepEqual(ok.values, { name: 'Sam', message: 'Congratulations!', relationship: null })
  })
  it('validates RSVPs', () => {
    const base = { name: 'Sam', responses: [{ event_id: 'e', attending: true, party_size: 2, max: 2 }] }
    assert.deepEqual(validateRsvp(base).errors, {})
    assert.ok(validateRsvp({ ...base, responses: [{ event_id: 'e', attending: true, party_size: 3, max: 2 }] }).errors.responses)
    assert.ok(validateRsvp({ ...base, responses: [{ event_id: 'e', attending: null }] }).errors.responses)
    assert.ok(validateRsvp({ ...base, email: 'nope' }).errors.email)
    assert.equal(validateRsvp({ ...base, responses: [{ event_id: 'e', attending: false, party_size: 4 }] }).values.responses[0].party_size, 0)
  })
  it('validates uploads', () => {
    assert.ok(validateUploadMeta({ name: 'A', files: [1], consent: false }).errors.consent)
    assert.ok(validateUploadMeta({ name: 'A', files: new Array(11).fill(1), consent: true }).errors.files)
    assert.equal(checkImageFile({ name: 'a.exe', type: 'application/octet-stream', size: 10 }), 'Only JPEG, PNG, WebP or HEIC photos can be uploaded.')
    assert.equal(checkImageFile({ name: 'a.svg', type: 'image/svg+xml', size: 10 }) !== null, true)
    assert.equal(checkImageFile({ name: 'a.jpg', type: 'image/jpeg', size: 10 }), null)
  })
})
