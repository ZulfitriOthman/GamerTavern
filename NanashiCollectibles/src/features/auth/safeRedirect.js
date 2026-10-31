// Post-login/post-register redirect target validation. `location.state.from`
// is always set by our own app code today (never derived from a URL query
// param), but this is cheap, defense-in-depth insurance against ever
// following an attacker-supplied absolute/protocol-relative URL if that
// ever changes — only a same-app internal path is ever allowed.
export function safeRedirect(path, fallback = "/") {
  if (typeof path !== "string" || path.length === 0) return fallback;
  if (!path.startsWith("/")) return fallback; // no relative/absolute external URLs
  if (path.startsWith("//") || path.startsWith("/\\")) return fallback; // protocol-relative tricks
  return path;
}
