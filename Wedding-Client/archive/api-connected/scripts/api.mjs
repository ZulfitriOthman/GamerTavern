// Runs this site's own instance of the shared Wedding API code (../Wedding/server)
// with Wedding-Client/server.env — a separate database, port and upload folder.
//
//   node scripts/api.mjs                         start the API (npm run dev:api)
//   node scripts/api.mjs create-admin [args…]    create an admin in THIS site's database
//
// Nothing in ../Wedding is modified; its config.js reads DOTENV_FILE.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const serverDir = path.resolve(root, '../Wedding/server')
const envFile = path.join(root, 'server.env')

if (!fs.existsSync(path.join(serverDir, 'src/index.js'))) {
  console.error(`[api] Wedding API code not found at ${serverDir}`)
  process.exit(1)
}
if (!fs.existsSync(envFile)) {
  console.error('[api] server.env is missing. Copy server.env.example to server.env and fill in this site’s database.')
  process.exit(1)
}

// Never let this instance fall back to the other site's settings.
const env = { ...process.env, DOTENV_FILE: envFile }
const fileVars = Object.fromEntries(
  fs
    .readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .map((l) => /^\s*([A-Z_]+)\s*=\s*(.*)$/.exec(l))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
)
if (!fileVars.UPLOAD_DIRECTORY) env.UPLOAD_DIRECTORY = path.join(root, '.api-data', 'uploads')
const port = fileVars.PORT || '4101'
if (port === '4100') console.warn('[api] PORT=4100 is the Zulfitri & Mariah API port — use a different one (e.g. 4101).')

const [command, ...rest] = process.argv.slice(2)
let args
if (command === 'create-admin') {
  // Verify the new account against THIS instance, never the production default.
  const hasApi = rest.includes('--api') || rest.includes('--no-verify')
  args = [path.join(serverDir, 'scripts/create-admin.js'), ...rest, ...(hasApi ? [] : ['--api', `http://localhost:${port}`])]
} else {
  args = ['--watch', path.join(serverDir, 'src/index.js')]
}

const child = spawn(process.execPath, args, { cwd: serverDir, env, stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 0))
