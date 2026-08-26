const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3002";

export class AuthError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new AuthError("Unable to reach the server. Please try again.", 0);
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // no JSON body
  }

  if (!response.ok) {
    throw new AuthError(body?.message || "Something went wrong. Please try again.", response.status);
  }

  return body;
}

// Backend contract: Backend/routes/api/auth.routes.js
// POST /api/auth/register — body: { name, email, phone?, password } — returns { ok, user, token }
export function register({ name, email, phone, password }) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, phone: phone || undefined, password }),
  });
}

// POST /api/auth/login — body: { email, password } — returns { ok, user, token }
export function login({ email, password }) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// GET /api/auth/me — Bearer token — returns { ok, user } where user is the decoded JWT
// payload ({ sub, email, name, role, iat, exp }), not the full PERSONAL_USER row.
export function me(token) {
  return request("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}
