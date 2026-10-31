// Starts the wedding API (server/, port 4100) and the Vite frontend (port 5173)
// together: `npm run dev:all`. Each one is skipped if something is already
// listening on its port, so this never starts duplicates or touches other
// processes. Ctrl+C stops only the processes this script started.
import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API_PORT = Number(process.env.WEDDING_API_PORT || 4100)
const WEB_PORT = 5173

function portInUse(port) {
  const attempt = (host) =>
    new Promise((resolve) => {
      const socket = net.connect({ port, host })
      socket.setTimeout(800)
      socket.once('connect', () => (socket.destroy(), resolve(true)))
      socket.once('timeout', () => (socket.destroy(), resolve(false)))
      socket.once('error', () => resolve(false))
    })
  return Promise.all([attempt('127.0.0.1'), attempt('::1')]).then(([a, b]) => a || b)
}

const children = []
function start(name, color, args, cwd) {
  const child = spawn('npm', args, { cwd, shell: process.platform === 'win32', stdio: ['inherit', 'pipe', 'pipe'] })
  const tag = `\x1b[${color}m[${name}]\x1b[0m `
  for (const stream of [child.stdout, child.stderr]) {
    let buffer = ''
    stream.on('data', (chunk) => {
      buffer += chunk
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop()
      for (const line of lines) process.stdout.write(tag + line + '\n')
    })
  }
  child.on('exit', (code) => console.log(`${tag}exited (${code ?? 'signal'})`))
  children.push(child)
}

if (await portInUse(API_PORT)) {
  console.log(`[dev:all] API already running on port ${API_PORT} — not starting another.`)
} else {
  start('api', 35, ['run', 'dev'], path.join(root, 'server'))
}

if (await portInUse(WEB_PORT)) {
  console.log(`[dev:all] Frontend already running on port ${WEB_PORT} — not starting another.`)
} else {
  start('web', 36, ['run', 'dev'], root)
}

if (children.length === 0) {
  console.log('[dev:all] Nothing to start.')
} else {
  const stop = () => {
    for (const child of children) {
      if (child.exitCode !== null) continue
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
      else child.kill('SIGINT')
    }
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}
