// Shared by admin/vite.config.js and portal/vite.config.js.
//
// The browser only ever talks to the hostname it loaded the app from
// (localhost:5301/5302 locally, or the public hostnames through the Cloudflare
// tunnel). The Vite dev/preview server forwards the Mashhor REST API and the
// Socket.IO transport to the demo Backend, so session cookies stay first-party
// and the API needs no CORS.
//
// /socket.io is the Backend's Socket.IO transport PATH (proxied here, with
// WebSocket upgrades). /mashoor is the Socket.IO NAMESPACE the apps join over
// that path; namespaces are not URL paths and need no proxy entry.

/** Demo Backend (npm run dev:api → config/demo-backend.dotenv PORT). */
export const backendTarget = (env) => env.API_URL || 'http://localhost:3012'

export const backendProxy = (target) => ({
  '/api/mashoor': { target },
  '/socket.io': { target, ws: true },
})

// Public hostnames served through the existing Cloudflare tunnel.
export const PUBLIC_HOSTS = {
  admin: 'mashhor.nanashicollectibles.com',
  portal: 'portal-mashhor.nanashicollectibles.com',
}
