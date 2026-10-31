// Provision (or reset) a wedding administrator from the LOCAL TERMINAL only.
// There is deliberately no sign-up page or HTTP endpoint for this.
//
//   cd Wedding
//   npm run create-admin                       → prompts for email, name, password
//   npm run create-admin -- --email you@example.com --name "Zulfitri"
//   npm run create-admin -- --email you@example.com --reset    → change a password
//
// • The password is read without echo and is never printed, logged or saved;
//   only its bcrypt hash (same algorithm/cost as the login: bcryptjs, BCRYPT_ROUNDS)
//   is stored in wedding_admins.
// • Uses the wedding MySQL connection from Wedding/server/.env.
// • Existing accounts are never overwritten unless --reset is given and confirmed.
// • After saving, it signs in once through the real login endpoint to prove the
//   account works, then signs out again (wedding_admin_sessions stays empty).
//   API: --api <url>, else WEDDING_API_URL, else https://backend.nanashicollectibles.com.
//   Use --no-verify to skip (e.g. when the API is not running).
// • Automation only: --password-stdin reads the password from standard input
//   (keeps it out of argv / shell history). Interactive use is preferred.
import { parseArgs } from 'node:util'
import { config } from '../src/config.js'
import { createPool } from '../src/db.js'
import { email as validEmail } from '../src/lib/validate.js'
import { adminPasswordProblem, createAdmin, hashAdminPassword } from '../src/services/auth.js'

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    reset: { type: 'boolean', default: false },
    api: { type: 'string' },
    'no-verify': { type: 'boolean', default: false },
    'password-stdin': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
})

const USAGE = `Usage (from Wedding/):
  npm run create-admin
  npm run create-admin -- --email you@example.com --name "Display name"
  npm run create-admin -- --email you@example.com --reset
Options: --api <url>  --no-verify  --password-stdin`

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (values.help) {
  console.log(USAGE)
  process.exit(0)
}

// --- terminal input --------------------------------------------------------
const interactive = Boolean(process.stdin.isTTY)
let stdinLines = null

async function readStdinLines() {
  if (stdinLines) return stdinLines
  let data = ''
  for await (const chunk of process.stdin) data += chunk
  stdinLines = data.split(/\r?\n/)
  return stdinLines
}

/** Reads one visible line (email, name, confirmations). */
async function ask(question) {
  if (!interactive) return (await readStdinLines()).shift() ?? ''
  const { createInterface } = await import('node:readline/promises')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return (await rl.question(question)).trim()
  } finally {
    rl.close()
  }
}

/** Reads a password with NO echo (raw mode). Nothing typed is ever written to the screen. */
function askHidden(question) {
  if (!interactive) return readStdinLines().then((lines) => lines.shift() ?? '')
  return new Promise((resolve) => {
    process.stdout.write(question)
    const stdin = process.stdin
    let value = ''
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off('data', onData)
          process.stdout.write('\n')
          return resolve(value)
        }
        if (ch === '\u0003') {
          stdin.setRawMode(false)
          process.stdout.write('\nCancelled.\n')
          process.exit(130)
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1)
        else if (ch >= ' ') value += ch
      }
    }
    stdin.on('data', onData)
  })
}

// --- inputs ------------------------------------------------------------------
if (!interactive && !values['password-stdin']) {
  fail('Run this in an interactive terminal (the password is typed without echo), or use --password-stdin for automation.')
}

const email = validEmail(values.email ?? (await ask('Admin email: ')))
if (!email) fail('A valid email address is required.\n' + USAGE)

const db = createPool()
let exitCode = 0
try {
  const [existing] = await db.query('SELECT id, display_name FROM wedding_admins WHERE email = ?', [email])
  const account = existing[0]
  if (account && !values.reset) {
    fail(`An admin with ${email} already exists — nothing was changed.\nTo change its password: npm run create-admin -- --email ${email} --reset`)
  }
  if (!account && values.reset) fail(`No admin with ${email} exists. Run without --reset to create it.`)

  const displayName = account ? account.display_name : ((values.name ?? (await ask('Display name (optional): '))) || null)
  if (displayName && displayName.length > 80) fail('Display name must be at most 80 characters.')

  if (interactive) console.log('Password: 12–72 characters. Typing is hidden.')
  const password = await askHidden('New admin password: ')
  const problem = adminPasswordProblem(password)
  if (problem) fail(problem)
  const confirm = await askHidden('Repeat password: ')
  if (password !== confirm) fail('Passwords do not match — nothing was changed.')

  if (account) {
    if (interactive && (await ask(`Type RESET to replace the password for ${email}: `)) !== 'RESET') fail('Not confirmed — nothing was changed.')
    await db.query('UPDATE wedding_admins SET password_hash = ?, is_active = 1 WHERE id = ?', [await hashAdminPassword(password), account.id])
    const [del] = await db.query('DELETE FROM wedding_admin_sessions WHERE admin_id = ?', [account.id])
    console.log(`✓ Password reset for ${email}. ${del.affectedRows} existing session(s) signed out.`)
  } else {
    try {
      await createAdmin(db, { email, password, displayName })
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') fail(`An admin with ${email} was created meanwhile — nothing was changed.`)
      throw error
    }
    console.log(`✓ Admin ${email} created.`)
  }

  // --- prove the account works through the real login endpoint -------------
  if (!values['no-verify']) {
    const apiBase = (values.api || process.env.WEDDING_API_URL || 'https://backend.nanashicollectibles.com').replace(/\/+$/, '').replace(/\/api(\/wedding)?$/, '')
    const loginUrl = `${apiBase}/api/wedding/auth/login`
    try {
      const res = await fetch(loginUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const body = await res.json().catch(() => null)
      if (res.ok && body?.admin?.email === email) {
        const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]
        await fetch(`${apiBase}/api/wedding/auth/logout`, { method: 'POST', headers: { cookie } }).catch(() => {})
        const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM wedding_admin_sessions s JOIN wedding_admins a ON a.id = s.admin_id WHERE a.email = ?', [email])
        console.log(`✓ Verified: signed in through ${loginUrl}, then signed out (sessions for this admin: ${n}).`)
      } else {
        exitCode = 1
        console.error(`✗ Saved, but signing in through ${loginUrl} failed (HTTP ${res.status}${body?.message ? `: ${body.message}` : ''}).`)
        console.error('  Check that this API uses the same database as Wedding/server/.env, or pass --api <url>.')
      }
    } catch (error) {
      exitCode = 1
      console.error(`✗ Saved, but could not reach ${loginUrl} to verify (${error.cause?.code || error.message}). Use --api <url> or --no-verify.`)
    }
  }
  console.log(`Sign in at ${config.publicSiteUrl}/admin/login`)
} catch (error) {
  exitCode = 1
  console.error('Could not provision the admin:', error.code === 'ER_NO_SUCH_TABLE' ? 'run the database migrations first.' : error.message)
} finally {
  await db.end()
}
// Let Node exit on its own: calling process.exit() while fetch's keep-alive
// socket is closing triggers a libuv assertion on Windows.
process.exitCode = exitCode
