import { API_BASE_URL } from '@/lib/config';

/** Error with the backend's stable `code` (e.g. ADMIN_REQUIRED) when it sent one. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isAuthError() {
    return this.status === 401;
  }
}

const TIMEOUT_MS = 15_000;

async function request<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError(
      `Can't reach the server at ${API_BASE_URL}. Check that the backend is running and your phone is on the same network.`,
      0,
      'NETWORK_ERROR',
    );
  } finally {
    clearTimeout(timer);
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON response; handled below */
  }

  if (!res.ok || body?.success === false) {
    const message = body?.message || `Request failed (HTTP ${res.status}).`;
    throw new ApiError(message, res.status, body?.code);
  }
  return body as T;
}

/* ----------------------------- Types ----------------------------- */

export type SessionUser = { sub: number; email: string; name: string; role: string };

export type Tournament = {
  id: number;
  name: string;
  status: string;
  startDate: string | null;
  location: string | null;
  registrationType: 'individual' | 'team' | string;
  gameName: string | null;
  eligibleCount: number;
  checkedInCount: number;
};

export type Registration = {
  id: number;
  displayName: string;
  name: string | null;
  nickname: string | null;
  isGuest: boolean;
  teamName: string | null;
  status: string;
  eligible: boolean;
  checkedInAt: string | null;
  checkedInBy: string | null;
};

export type Roster = {
  tournament: { id: number; name: string; status: string };
  checkInOpen: boolean;
  registrations: Registration[];
};

export type CheckInResult = {
  alreadyCheckedIn: boolean;
  checkIn: { registrationId: number; tournamentId: number; checkedInAt: string; checkedInBy: string | null };
};

/* ----------------------------- Calls ----------------------------- */

export async function login(email: string, password: string) {
  // Existing canonical REST auth: Backend/routes/api/auth.routes.js
  return request<{ ok: true; user: SessionUser; token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchMe(token: string) {
  return request<{ ok: true; user: SessionUser }>('/api/auth/me', { token });
}

export async function fetchTournaments(token: string) {
  const res = await request<{ success: true; data: Tournament[] }>('/api/attendance/tournaments', { token });
  return res.data;
}

export async function fetchRoster(token: string, tournamentId: number) {
  const res = await request<{ success: true; data: Roster }>(
    `/api/attendance/tournaments/${tournamentId}/registrations`,
    { token },
  );
  return res.data;
}

/** Idempotent on the server: repeating it returns alreadyCheckedIn: true, never a second record. */
export async function checkIn(token: string, tournamentId: number, registrationId: number) {
  const res = await request<{ success: true; data: CheckInResult }>(
    `/api/attendance/tournaments/${tournamentId}/registrations/${registrationId}/check-in`,
    { method: 'POST', token },
  );
  return res.data;
}
