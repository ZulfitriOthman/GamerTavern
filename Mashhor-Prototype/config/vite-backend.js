// Shared by admin/vite.config.js and portal/vite.config.js.
//
// The browser only ever talks to the hostname it loaded the app from
// (localhost:5301/5302 locally, or the public hostnames through the Cloudflare
// tunnel). The Vite dev/preview server forwards the Mashhor REST API and the
// Socket.IO transport to the Backend, so session cookies stay first-party
// and the API needs no CORS.
//
// /socket.io is the Backend's Socket.IO transport PATH (proxied here, with
// WebSocket upgrades). /mashoor is the Socket.IO NAMESPACE the apps join over
// that path; namespaces are not URL paths and need no proxy entry.

/**
 * The existing Backend service: the Docker container from Backend/compose.yaml,
 * published on 127.0.0.1:3002. Its Mashoor module reads and writes the
 * mashoor_* tables in the Backend's MySQL / MariaDB database.
 * Override with API_URL. 127.0.0.1, not localhost: the container is published on
 * IPv4 only, and localhost may resolve to ::1 first (ECONNREFUSED).
 */
export const backendTarget = (env) => env.API_URL || 'http://127.0.0.1:3002'

export const backendProxy = (target) => ({
  '/api/mashoor': { target },
  '/socket.io': { target, ws: true },
})

// Where the Vite dev/preview servers listen: IPv4 loopback only (not the
// LAN), so the Cloudflare tunnel on this host can reach them as
// http://127.0.0.1:5301 / :5302 (and as localhost). Vite's default here was ::1 only.
export const LISTEN_HOST = '127.0.0.1'

// Public hostnames served through the existing Cloudflare tunnel (bare host
// names, as Vite's allowedHosts expects). Each app allows only its own.
export const PUBLIC_HOSTS = {
  admin: 'mashhor.nanashicollectibles.com',
  portal: 'portal-mashhor.nanashicollectibles.com',
}
