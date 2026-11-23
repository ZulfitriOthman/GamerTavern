import { fileURLToPath } from 'node:url'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'
import { backendProxy, backendTarget, PUBLIC_HOSTS } from '../config/vite-backend.js'

// Reused code, imported in place (not copied):
//   @mashoor/shared/*  — the existing shared frontend package (API client, auth,
//                        login, checklist form, A4 print, styles)
//   @legacy-admin/*    — inspection-focused pages of the existing admin site
//   @prototype/*       — code shared by the two prototype apps
const dir = (path) => fileURLToPath(new URL(path, import.meta.url))
const sharedSrc = dir('../../Listing-Sample/Mashoor/packages/shared/src')
const legacyAdmin = dir('../../Listing-Sample/Mashoor/admin/src')
const prototypeShared = dir('../shared/src')

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  // /api/mashoor and /socket.io → the demo Backend (see ../config/vite-backend.js).
  const proxy = backendProxy(backendTarget(env))
  // Served through the Cloudflare tunnel under this public hostname.
  const allowedHosts = [PUBLIC_HOSTS.admin]
  // 5301 is in the Mashoor module's default allowed-origin list (CSRF guard).
  const port = 5301

  return {
    plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
    resolve: {
      alias: [
        { find: /^@mashoor\/shared\//, replacement: `${sharedSrc}/` },
        { find: /^@legacy-admin\//, replacement: `${legacyAdmin}/` },
        { find: /^@prototype\//, replacement: `${prototypeShared}/` },
      ],
      // Reused files live outside this project; always use this project's React.
      dedupe: ['react', 'react-dom', 'react-router', 'socket.io-client'],
    },
    server: {
      port,
      strictPort: true,
      proxy,
      allowedHosts,
      fs: { allow: ['.', sharedSrc, legacyAdmin, prototypeShared] },
    },
    preview: { port, strictPort: true, proxy, allowedHosts },
  }
})
