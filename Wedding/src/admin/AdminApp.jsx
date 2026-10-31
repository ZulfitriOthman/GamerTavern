import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext.jsx'
import { AdminLayout } from './components/AdminLayout.jsx'
import { RequireAdmin } from './components/RequireAdmin.jsx'
import { EventsAdmin } from './pages/EventsAdmin.jsx'
import { GreetingsAdmin } from './pages/GreetingsAdmin.jsx'
import { GuestsAdmin } from './pages/GuestsAdmin.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { OverviewPage } from './pages/OverviewPage.jsx'
import { PhotosAdmin } from './pages/PhotosAdmin.jsx'
import { RsvpAdmin } from './pages/RsvpAdmin.jsx'
import { SettingsAdmin } from './pages/SettingsAdmin.jsx'

export default function AdminApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="rsvps" element={<RsvpAdmin />} />
          <Route path="guests" element={<GuestsAdmin />} />
          <Route path="photos" element={<PhotosAdmin />} />
          <Route path="wishes" element={<GreetingsAdmin />} />
          <Route path="events" element={<EventsAdmin />} />
          <Route path="settings" element={<SettingsAdmin />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
