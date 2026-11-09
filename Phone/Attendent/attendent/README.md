# Attendent

Tournament check-in app for Gamer Tavern staff (Expo SDK 58, Expo Router, TypeScript).

An **admin** signs in, picks a tournament that is `open` or `closed` for registration, and taps
**Check in** next to each registered participant (account holders and guests). Checking someone
in twice is harmless: the server keeps exactly one record and the app shows
"already checked in at …".

- API: `Backend/routes/api/attendance.routes.js` (mounted at `/api/attendance`, admin-only)
- Auth: the existing `POST /api/auth/login` / `GET /api/auth/me`
- Data: `TOURNAMENTS`, `TOURNAMENT_REGISTRATIONS`, and `PHONE_TOURNAMENT_CHECKINS`
  (`Database/migrations/0010_add_phone_tournament_checkins.sql`)

The app only talks to the API. It never contains SQL or database credentials.

## Layout

```
src/app/_layout.tsx          Stack navigator + AuthProvider
src/app/index.tsx            Sign in → tournaments open for check-in
src/app/tournament/[id].tsx  Roster with search and the Check in action
src/lib/api.ts               Typed API client (ApiError carries the backend's error code)
src/lib/auth.tsx             Session (token in expo-secure-store; memory-only on web)
src/lib/config.ts            Backend URL resolution
```

## Pointing the app at the backend

By default the app calls `http://<the IP of the machine running Expo>:3002`, which works
when the backend runs on the same computer as `npx expo start` and your phone is on the same Wi-Fi.
To override, create `.env.local` (gitignored):

```
EXPO_PUBLIC_API_URL=http://192.168.1.20:3002
```

Restart Expo after changing it. The current server address is shown on the sign-in screen.

## Commands

```bash
npm install
npx expo start        # scan the QR code with Expo Go (Android) or the Camera app (iOS)
npx tsc --noEmit      # type check
npx eslint src        # lint
```
