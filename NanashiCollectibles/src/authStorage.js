const USER_KEY = "tavern_current_user";
const USERNAME_KEY = "tavern_username";

function getSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readRaw(key) {
  const session = getSessionStorage();
  const local = getLocalStorage();

  const sessionValue = session?.getItem(key);
  if (sessionValue != null) return sessionValue;

  const localValue = local?.getItem(key);
  return localValue ?? null;
}

function writeSessionOnly(key, value) {
  const session = getSessionStorage();
  const local = getLocalStorage();

  if (session) {
    session.setItem(key, value);
  }

  if (local) {
    local.removeItem(key);
  }
}

export function getCurrentUser() {
  try {
    const raw = readRaw(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user) {
  if (!user) return;
  writeSessionOnly(USER_KEY, JSON.stringify(user));
}

export function clearCurrentUser() {
  const session = getSessionStorage();
  const local = getLocalStorage();
  session?.removeItem(USER_KEY);
  local?.removeItem(USER_KEY);
}

export function getUsername(fallback = null) {
  const name = readRaw(USERNAME_KEY);
  return name || fallback;
}

export function setUsername(name) {
  const safeName = String(name || "").trim();
  if (!safeName) return;
  writeSessionOnly(USERNAME_KEY, safeName);
}

export function clearUsername() {
  const session = getSessionStorage();
  const local = getLocalStorage();
  session?.removeItem(USERNAME_KEY);
  local?.removeItem(USERNAME_KEY);
}

export function clearAuthStorage() {
  clearCurrentUser();
  clearUsername();
}
