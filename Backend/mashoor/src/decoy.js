// Decoy inspection export — a defensive tripwire, not a feature.
//
// GET /api/mashoor/admin/exports/inspections.csv is never linked from the
// Admin or Portal UI and no real workflow requests it. When enabled, a request
// makes the Backend GET one server-configured Canarytokens URL (the alert), and
// the caller always gets the router's ordinary JSON 404 — straight away, before
// the alert is sent, whether the alert succeeds, fails or times out.
//
// - Disabled unless MASHOOR_DECOY_EXPORT_ENABLED=true AND
//   MASHOOR_DECOY_EXPORT_URL is a canarytokens.com/.org https/http URL.
//   When disabled the route is not registered at all.
// - The destination is only ever that configured URL; nothing from the request
//   (query, headers, body, cookies, IP) is read or forwarded.
// - One alert per cooldown window (MASHOOR_DECOY_EXPORT_COOLDOWN_MINUTES,
//   default 15) for the whole process, so a scanner cannot flood the inbox.
// - The token URL is never logged; failures are logged by error code only.
// - Reads no data at all, so it never returns real data, even to signed-in staff.

/** Path inside the /admin router. */
export const DECOY_EXPORT_PATH = '/exports/inspections.csv'

const TOKEN_DOMAINS = ['canarytokens.com', 'canarytokens.org']
const DEFAULT_COOLDOWN_MINUTES = 15
const DEFAULT_TIMEOUT_MS = 3000

/** The exact configured token URL, or null when it is not an acceptable Canarytokens URL. */
export function checkTokenUrl(raw) {
  const value = (raw || '').trim()
  if (!value) return null
  let url
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  const host = url.hostname.toLowerCase()
  if (!TOKEN_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) return null
  return value
}

/** Decoy settings from MASHOOR_DECOY_EXPORT_* (see config.js). Disabled by default. */
export function decoyExportSettings(env) {
  if (env.MASHOOR_DECOY_EXPORT_ENABLED !== 'true') return { enabled: false }
  const url = checkTokenUrl(env.MASHOOR_DECOY_EXPORT_URL)
  if (!url) {
    return { enabled: false, problem: 'MASHOOR_DECOY_EXPORT_URL is missing or is not a Canarytokens URL' }
  }
  const minutes = Number(env.MASHOOR_DECOY_EXPORT_COOLDOWN_MINUTES)
  return {
    enabled: true,
    url,
    cooldownMs: (Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_COOLDOWN_MINUTES) * 60_000,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  }
}

/**
 * The outbound alert: a plain GET to the exact token URL with a short timeout.
 * No cookies, no forwarded headers, no query added, redirects not followed.
 */
export async function sendDecoyAlert(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'manual',
    credentials: 'omit',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  })
  await res.body?.cancel()
  if (res.status >= 400) throw Object.assign(new Error('alert rejected'), { status: res.status })
}

// Error code only: fetch error messages can carry the destination.
const describeFailure = (error) => {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'timed out'
  if (error?.status) return `HTTP ${error.status}`
  return error?.cause?.code || error?.name || 'unknown error'
}

/** Express handler for the decoy route. `send`, `now` and `log` are injectable for tests. */
export function createDecoyExport({
  url,
  cooldownMs = DEFAULT_COOLDOWN_MINUTES * 60_000,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  send = sendDecoyAlert,
  now = Date.now,
  log = console,
}) {
  let nextAlertAt = 0
  let throttled = 0

  function trigger() {
    const t = now()
    if (t < nextAlertAt) {
      throttled += 1
      return
    }
    // Reserve the window before sending, so concurrent hits cannot all send,
    // and a failed send still waits out the cooldown.
    nextAlertAt = t + cooldownMs
    const skipped = throttled
    throttled = 0
    log.warn(`[mashoor-api] decoy export requested; sending alert${skipped ? ` (${skipped} earlier request(s) throttled)` : ''}`)
    Promise.resolve()
      .then(() => send(url, timeoutMs))
      .catch((error) => log.warn(`[mashoor-api] decoy alert not delivered: ${describeFailure(error)}`))
  }

  return (req, res) => {
    // Express routes HEAD to GET handlers; only a real GET trips the alert.
    if (req.method === 'GET') trigger()
    res.status(404).json({ error: 'Not found.' })
  }
}
