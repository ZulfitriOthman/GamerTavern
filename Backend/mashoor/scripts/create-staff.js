// Create a staff (admin) account.
//   npm run mashoor:create-staff -- --email   (from Backend/)
//   e.g. --email you@company.com --name "Your Name"
// The password is read from STAFF_PASSWORD, or prompted for if unset.
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { loadConfig } from '../src/config.js'
import { audit, openDatabase } from '../src/db.js'
import { hashPassword, passwordProblem } from '../src/auth/passwords.js'
import { normalizeEmail } from '../src/validate.js'

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } })
const email = normalizeEmail(values.email)
const name = values.name?.trim()
if (!email || !name) {
  console.error('Usage: npm run mashoor:create-staff -- --email you@company.com --name "Your Name"')
  process.exit(1)
}

let password = process.env.STAFF_PASSWORD
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  password = await rl.question('Password (min 10 chars): ')
  rl.close()
}
const problem = passwordProblem(password)
if (problem) {
  console.error(problem)
  process.exit(1)
}

const db = openDatabase(loadConfig().dbPath)
if (db.prepare('SELECT 1 FROM staff_users WHERE email = ?').get(email)) {
  console.error(`Staff account ${email} already exists.`)
  process.exit(1)
}
const { lastInsertRowid } = db
  .prepare('INSERT INTO staff_users (email, name, password_hash) VALUES (?, ?, ?)')
  .run(email, name, await hashPassword(password))
audit(db, { actorType: 'system', action: 'staff.create', targetType: 'staff_user', targetId: Number(lastInsertRowid) })
console.log(`Created staff account ${email}.`)
