import { fileURLToPath } from 'node:url'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'

// Shared frontend code (API client, auth, login page, styles) lives outside
// this project in ../packages/shared and is imported as `@mashoor/shared/*`.
const sharedSrc = fileURLToPath(new URL('../packages/shared/src', import.meta.url))

export default defineConfig(({ mode }) => {
  // API_URL may come from the shell or from .env / .env.local in this folder.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  // The Mashoor API is served by the shared GamerTavern Backend under
  // /api/mashoor. Proxying keeps session cookies first-party to this origin.
  const apiTarget = env.API_URL || 'http://localhost:3002'

  return {
    plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
    resolve: {
      alias: [{ find: /^@mashoor\/shared\//, replacement: `${sharedSrc}/` }],
      // Shared files sit outside this project's node_modules tree; always use
      // this project's single copy of React / React Router.
      dedupe: ['react', 'react-dom', 'react-router'],
    },
    server: {
      port: 5301,
      strictPort: true,
      proxy: { '/api/mashoor': apiTarget },
      fs: { allow: ['.', sharedSrc] },
      allowedHosts: ['admin.nanashicollectibles.com'],
    },
    preview: {
      port: 5301,
      strictPort: true,
      proxy: { '/api/mashoor': apiTarget },
      allowedHosts: ['admin.nanashicollectibles.com'],
    },
  }
})
