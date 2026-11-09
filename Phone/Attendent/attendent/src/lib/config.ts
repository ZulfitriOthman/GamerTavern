import Constants from 'expo-constants';

/**
 * Where the Attendent app finds the GamerTavern backend (Backend/server.js).
 *
 * 1. EXPO_PUBLIC_API_URL, if set (e.g. in .env.local), wins:
 *      EXPO_PUBLIC_API_URL=http://192.168.1.20:3002
 * 2. Otherwise, in development, reuse the LAN IP of the machine running the
 *    Expo dev server (the phone can already reach it) on EXPO_PUBLIC_API_PORT
 *    (default 3002, the backend's default PORT).
 * 3. Fallback: localhost (works for web and the iOS simulator only).
 *
 * Only the API URL lives here. The app never holds SQL or database credentials.
 */
const DEFAULT_PORT = process.env.EXPO_PUBLIC_API_PORT || '3002';

function resolveApiBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.20:8081"
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${DEFAULT_PORT}`;

  return `http://localhost:${DEFAULT_PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();
