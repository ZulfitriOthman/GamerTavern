// Create a staff (admin) account for the Mashoor Admin site — terminal only,
// there is no signup page or API route that creates staff.
//
//   npm run mashoor:create-staff -- --email you@company.com --name "Your Name"   (from Backend/)
//
// The password is never an argument or an environment variable: it is typed
// at a hidden prompt (asked twice). When stdin is not a terminal (piped), the
// first two lines are read as password and confirmation instead.
//
// Same database, hashing and role as the staff sign-in
// (src/routes/admin.js POST /auth/login): MySQL table mashoor_staff_users,
// email normalised with normalizeEmail, bcrypt via hashPassword, role 'admin',
// active 1. An existing email is refused and nothing is changed.
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { loadConfig } from '../src/config.js'
import { audit, isDuplicate, openDatabase } from '../src/db.js'
import { hashPassword, passwordProblem } from '../src/auth/passwords.js'
import { normalizeEmail } from '../src/validate.js'

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } })
const email = normalizeEmail(values.email)
const name = values.name?.trim()
if (!email || !name || name.length > 200) {
  fail('Usage: npm run mashoor:create-staff -- --email you@company.com --name "Your Name"   (the password is asked for)')
}

// Piped stdin: one line per answer, read in order.
let pipedLines
function readPipedLine() {
  pipedLines ??= (async function* lines() {
    for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) yield line
  })()
  return pipedLines.next().then((r) => (r.done ? '' : r.value))
}

// Terminal: raw mode, nothing echoed (not even a mask), Backspace and Ctrl+C handled.
function askHidden(question) {
  if (!process.stdin.isTTY) return readPipedLine()
  return new Promise((resolve) => {
    const stdin = process.stdin
    let value = ''
    process.stdout.write(question)
    const finish = () => {
      stdin.off('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      process.stdout.write('\n')
      resolve(value)
    }
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') return finish()
        if (ch === '\u0003') {
          stdin.setRawMode(false)
          process.stdout.write('\nCancelled.\n')
          process.exit(130)
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1)
        else if (ch >= ' ') value += ch
      }
    }
    stdin.setEncoding('utf8')
    stdin.setRawMode(true)
    stdin.resume()
    stdin.on('data', onData)
  })
}

const config = loadConfig()
const db = await openDatabase(config.mysql, { importChecklists: false })
try {
  console.log(`Database: ${db.info.where} (${db.info.version})`)
  // Refuse a duplicate before asking for a password.
  if (await db.prepare('SELECT 1 FROM mashoor_staff_users WHERE email = ?').get(email)) {
    fail(`A staff account with ${email} already exists in ${db.info.database}. Nothing was changed.`)
  }
  const password = await askHidden('Password (min 10 characters, hidden): ')
  const problem = passwordProblem(password)
  if (problem) fail(problem)
  if ((await askHidden('Repeat password: ')) !== password) fail('The passwords do not match. Nothing was changed.')

  let id
  try {
    const result = await db
      .prepare("INSERT INTO mashoor_staff_users (email, name, password_hash, role, active) VALUES (?, ?, ?, 'admin', 1)")
      .run(email, name, await hashPassword(password))
    id = Number(result.lastInsertRowid)
  } catch (error) {
    // Unique email index (case-insensitive): a concurrent create took it.
    if (isDuplicate(error)) fail(`A staff account with ${email} already exists in ${db.info.database}. Nothing was changed.`)
    throw error
  }
  await audit(db, { actorType: 'system', action: 'staff.create', targetType: 'staff_user', targetId: id })
  console.log(`Created staff admin ${email} (id ${id}) in ${db.info.database}. Sign in at the Admin site with this email.`)
} finally {
  await db.close()
}
