import * as SecureStore from 'expo-secure-store';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiError, fetchMe, login as apiLogin, type SessionUser } from '@/lib/api';

const TOKEN_KEY = 'attendent.session-token';

// SecureStore exists on Android/iOS (incl. Expo Go). On web it doesn't, so
// the session is simply kept in memory there.
async function readToken() {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}
async function writeToken(token: string | null) {
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* unsupported platform — in-memory only */
  }
}

const isAdmin = (user: SessionUser) => String(user.role).toUpperCase() === 'ADMIN';

type AuthState = {
  status: 'restoring' | 'signedOut' | 'signedIn';
  token: string | null;
  user: SessionUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('restoring');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);

  const signOut = useCallback(async () => {
    setToken(null);
    setUser(null);
    setStatus('signedOut');
    await writeToken(null);
  }, []);

  // Restore a saved session, re-validated against the server (expired/revoked
  // tokens or a role change are caught here, not trusted from storage).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await readToken();
      if (!saved) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      try {
        const { user: me } = await fetchMe(saved);
        if (cancelled) return;
        if (!isAdmin(me)) throw new ApiError('Not an admin', 403, 'ADMIN_REQUIRED');
        setToken(saved);
        setUser(me);
        setStatus('signedIn');
      } catch (err) {
        if (cancelled) return;
        // Offline at launch: keep the saved session; API calls will surface errors.
        if (err instanceof ApiError && err.code === 'NETWORK_ERROR') {
          setToken(saved);
          setStatus('signedIn');
          return;
        }
        await writeToken(null);
        setStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user: me, token: newToken } = await apiLogin(email, password);
    if (!isAdmin(me)) {
      throw new ApiError('Only admin accounts can check people in.', 403, 'ADMIN_REQUIRED');
    }
    await writeToken(newToken);
    setToken(newToken);
    setUser(me);
    setStatus('signedIn');
  }, []);

  const value = useMemo(() => ({ status, token, user, signIn, signOut }), [status, token, user, signIn, signOut]);
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
