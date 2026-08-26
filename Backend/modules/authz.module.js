// Backend/modules/authz.module.js
// Reusable Socket.IO authorization helpers. Identity always comes from `socket.user`
// (populated once, server-side, by the io.use() JWT middleware in server.js) — never
// from a client-supplied payload field. See CLAUDE.md "Socket.IO authorization matrix".
const ADMIN_ROLE = "ADMIN";

function isAdminRole(role) {
  return String(role || "").toUpperCase() === ADMIN_ROLE;
}

export function requireAuthenticated(socket) {
  if (!socket.user) {
    return { ok: false, code: "AUTH_REQUIRED", message: "Authentication required." };
  }
  return { ok: true, user: socket.user };
}

export function requireAdmin(socket) {
  const auth = requireAuthenticated(socket);
  if (!auth.ok) return auth;
  if (!isAdminRole(auth.user.role)) {
    return { ok: false, code: "ADMIN_REQUIRED", message: "Admin privileges required." };
  }
  return auth;
}

// Allows the resource's own owner, or an admin. `resourceOwnerId` may be null/undefined
// (e.g. resource not found yet) — that never matches, so ownership fails closed.
export function requireOwnerOrAdmin(socket, resourceOwnerId) {
  const auth = requireAuthenticated(socket);
  if (!auth.ok) return auth;
  const isOwner = resourceOwnerId != null && String(auth.user.id) === String(resourceOwnerId);
  if (!isOwner && !isAdminRole(auth.user.role)) {
    return { ok: false, code: "NOT_OWNER", message: "Not allowed." };
  }
  return auth;
}
