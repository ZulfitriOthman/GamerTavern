// Couple's dashboard. Loaded as its own chunk. Access is decided by the API
// (session cookie + CSRF token); this UI only reflects that decision.
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoadError, Spinner } from '../components/ui/Feedback.jsx'
import { AuthProvider, useAuth } from './auth.jsx'
import { AdminLayout } from './components/AdminLayout.jsx'
import LoginPage from './pages/LoginPage.jsx'
import OverviewPage from './pages/OverviewPage.jsx'

const RsvpsPage = lazy(() => import('./pages/RsvpsPage.jsx'))
const GuestsPage = lazy(() => import('./pages/GuestsPage.jsx'))
const PhotosPage = lazy(() => import('./pages/PhotosPage.jsx'))
const WishesPage = lazy(() => import('./pages/WishesPage.jsx'))
const EventsPage = lazy(() => import('./pages/EventsPage.jsx'))
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'))

export default function AdminApp() {
  return (
    <AuthProvider>
      <title>Dashboard · Wedding</title>
      <meta name="robots" content="noindex" />
      <Gate />
    </AuthProvider>
  )
}

function Gate() {
  const { status, error, check } = useAuth()

  if (status === 'checking') {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner label="Checking your session" />
      </div>
    )
  }
  if (status === 'unreachable') {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="w-full max-w-md">
          <LoadError
            onRetry={check}
            message={
              <>
                {error} The dashboard needs the Wedding API. Check that it is running and that its database is configured (
                <code className="text-xs">/api/wedding/health</code>).
              </>
            }
          />
        </div>
      </div>
    )
  }
  if (status !== 'signed-in') return <LoginPage />

  return (
    <AdminLayout>
      <Suspense fallback={<Spinner label="Loading" />}>
        <Routes>
          <Route index element={<OverviewPage />} />
          <Route path="rsvps" element={<RsvpsPage />} />
          <Route path="guests" element={<GuestsPage />} />
          <Route path="photos" element={<PhotosPage />} />
          <Route path="wishes" element={<WishesPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Suspense>
    </AdminLayout>
  )
}
