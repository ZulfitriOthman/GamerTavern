import { useCallback, useEffect, useMemo, useState } from "react";
import * as authService from "./authService.js";
import { AuthContext } from "./AuthContext.js";

const STORAGE_KEY = "nc.auth.token";

// Trade-off: the backend only issues bearer JWTs (no cookie/session support), so the
// token is kept in localStorage to survive reloads. This is readable by any script on
// the page (XSS risk) — acceptable for now since there's no first-party script beyond
// this app, but revisit if the backend ever adds httpOnly-cookie-based sessions.
function readStoredToken() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable (private browsing, etc.) — session just won't persist
  }
}

export function AuthProvider({ children }) {
  // Lazy initializers so the "no stored token" case resolves synchronously on first
  // render, with no effect needed for it — only the token-validation case is async.
  const [token, setToken] = useState(() => readStoredToken());
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() => (readStoredToken() ? "loading" : "unauthenticated"));

  useEffect(() => {
    if (!token) return undefined;

    let cancelled = false;
    authService
      .me(token)
      .then((res) => {
        if (cancelled) return;
        setUser(res.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        writeStoredToken(null);
        setToken(null);
        setStatus("unauthenticated");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (credentials) => {
    const res = await authService.login(credentials);
    writeStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);
    setStatus("authenticated");
    return res.user;
  }, []);

  const register = useCallback(async (fields) => {
    const res = await authService.register(fields);
    writeStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);
    setStatus("authenticated");
    return res.user;
  }, []);

  const logout = useCallback(() => {
    writeStoredToken(null);
    setToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  // Hydrates this same shared session from a token/user pair obtained through a
  // DIFFERENT login call than authService.login/register — e.g. the merchant portal's
  // POST /api/merchant/auth/login or /api/merchant/register, which return the same
  // JWT shape but aren't issued through authService. Everything that depends on this
  // context (the customer storefront session AND SocketProvider's handshake auth)
  // then sees the merchant as logged in too — a merchant IS a user, so this is one
  // shared identity, not two. Added so merchant auth can reuse this instead of
  // duplicating token storage/session wiring.
  const setSession = useCallback((nextToken, nextUser) => {
    writeStoredToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    setStatus(nextToken ? "authenticated" : "unauthenticated");
  }, []);

  const value = useMemo(
    () => ({ status, user, token, login, register, logout, setSession }),
    [status, user, token, login, register, logout, setSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
