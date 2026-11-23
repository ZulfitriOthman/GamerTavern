// Demo backend helper for the Mashhor prototype. Uses the EXISTING Backend
// service and Mashoor module; it only chooses demo settings.
//
//   node scripts/demo.mjs api     start Backend/server.js with config/demo-backend.dotenv
//   node scripts/demo.mjs setup   staff account (Backend's terminal-only create-staff) + fictional demo data
//   node scripts/demo.mjs reset   delete ONLY the demo database/storage, then setup again
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

const root = fileURLToPath(new URL('..', import.meta.url))
const backend = resolve(root, '..', 'Backend')
const envFile = resolve(root, 'config', 'demo-backend.dotenv')
const demo = parseEnv(readFileSync(envFile, 'utf8'))
const dbPath = resolve(backend, demo.MASHOOR_DB_PATH)
const storageDir = resolve(backend, demo.MASHOOR_STORAGE_DIR)
const demoDataDir = resolve(backend, 'mashoor', 'data', 'demo')

// Fictional staff account, created with the Backend's own terminal-only script.
const STAFF = { email: 'staff@mashhor-demo.test', name: 'Demo Staff', password: 'Demo-Staff-2026!' }

function die(message) {
  console.error(`[demo] ${message}`)
  process.exit(1)
}

if (!existsSync(resolve(backend, 'server.js'))) die(`Backend not found at ${backend}.`)
// Never touch anything outside Backend/mashoor/data/demo.
for (const p of [dbPath, storageDir]) {
  if (!p.startsWith(demoDataDir + sep)) die(`Refusing: ${p} is outside ${demoDataDir}.`)
}
if (!/demo/i.test(basename(dbPath))) die('Refusing: the demo database file name must contain "demo".')

const portFree = (port) =>
  new Promise((done) => {
    const s = createServer()
    s.once('error', () => done(false))
    s.listen(port, () => s.close(() => done(true)))
  })

// Env for Backend scripts: demo database + storage, development mode.
const scriptEnv = { ...process.env, NODE_ENV: 'development', MASHOOR_DB_PATH: dbPath, MASHOOR_STORAGE_DIR: storageDir }

function npmBackend(args, env) {
  const result = spawnSync(`npm ${args}`, { cwd: backend, env, shell: true, encoding: 'utf8' })
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

function setup() {
  console.log(`[demo] Database: ${dbPath}`)
  const staff = npmBackend(`run mashoor:create-staff -- --email ${STAFF.email} --name "${STAFF.name}"`, { ...scriptEnv, STAFF_PASSWORD: STAFF.password })
  if (staff.status === 0) console.log(`[demo] Staff account created with mashoor:create-staff: ${STAFF.email}`)
  else if (/already exists/.test(staff.output)) console.log(`[demo] Staff account ${STAFF.email} already exists.`)
  else die(`create-staff failed:\n${staff.output}`)

  const seed = npmBackend('run mashoor:seed-demo', { ...scriptEnv, DEMO_STAFF_EMAIL: STAFF.email, DEMO_STAFF_PASSWORD: STAFF.password })
  process.stdout.write(seed.output.split('\n').filter((l) => !l.startsWith('>') && l.trim()).join('\n') + '\n')
  if (seed.status !== 0) die('Demo seed failed.')
  console.log(`[demo] Admin site sign-in: ${STAFF.email} / ${STAFF.password}`)
}

async function reset() {
  if (!(await portFree(Number(demo.PORT)))) die(`Port ${demo.PORT} is in use — stop the demo API (npm run dev) before resetting.`)
  for (const suffix of ['', '-wal', '-shm']) rmSync(dbPath + suffix, { force: true })
  rmSync(storageDir, { recursive: true, force: true })
  console.log(`[demo] Removed demo database and storage under ${dirname(dbPath)}`)
  setup()
}

async function api() {
  const port = Number(demo.PORT)
  if (!(await portFree(port))) die(`Port ${port} is already in use. Stop whatever is using it, or change PORT in config/demo-backend.dotenv (and API_URL for the Vite proxies).`)
  if (!existsSync(dbPath)) console.warn('[demo] Demo database not found yet — run `npm run demo:setup` (the API creates an empty one otherwise).')
  const child = spawn(process.execPath, ['server.js'], {
    cwd: backend,
    stdio: 'inherit',
    // DOTENV_FILE (relative to Backend/) replaces .env.dev for this process only.
    env: { ...process.env, NODE_ENV: 'development', DOTENV_FILE: relative(backend, envFile) },
  })
  child.on('exit', (code) => process.exit(code ?? 0))
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
}

const command = process.argv[2]
if (command === 'api') await api()
else if (command === 'setup') setup()
else if (command === 'reset') await reset()
else die('Usage: node scripts/demo.mjs api | setup | reset')
