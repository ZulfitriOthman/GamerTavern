import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router'
import { RequireAuth } from '@mashoor/shared/AuthProvider'
import { useAuth } from '@mashoor/shared/useAuth'
import { LoginPage } from '@mashoor/shared/LoginPage'
import { Icon } from '@mashoor/shared/Icon'
import { Avatar, Brand } from '@mashoor/shared/ui'
import { api } from './api.js'
import MyCatalogsPage from './pages/MyCatalogsPage.jsx'
import ListingDetailPage from './pages/ListingDetailPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import InspectionsPage from './pages/InspectionsPage.jsx'
import InspectionPage from './pages/InspectionPage.jsx'
import InspectionPrintPage from './pages/InspectionPrintPage.jsx'

// Default page after sign-in, and for the portal root. Vendor/Client accounts
// land on My Catalogs; Inspector accounts are sent on to their inspections.
const HOME = '/'
// Pages sign-in may return to (deep links / expired sessions). What a vendor may
// actually see is still decided by the API on that page.
const RETURNABLE = [/^\/$/, /^\/listings\/\d{1,15}$/, /^\/settings$/, /^\/inspections$/, /^\/inspections\/\d{1,15}$/, /^\/inspections\/\d{1,15}\/print$/]
const isAllowedReturn = (pathname) => RETURNABLE.some((pattern) => pattern.test(pathname))

// Catalog pages are for Vendor / Client accounts (the API enforces this too).
function ClientOnly({ children }) {
  const { session } = useAuth()
  return session.user.role === 'client' ? children : <Navigate to="/inspections" replace />
}

function Layout() {
  const { session, logout } = useAuth()
  const location = useLocation()
  const [counts, setCounts] = useState(null)
  const isInspector = session.user.role === 'inspector'

  // Queue sizes for the nav badge; refreshed on every navigation.
  useEffect(() => {
    let cancelled = false
    api('/inspections/counts').then(
      (data) => !cancelled && setCounts(data.counts),
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [location.key])

  const waiting = counts ? (isInspector ? counts.returned + counts.assigned : counts.pending_verification) + counts.signoffs : 0

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="portal-header">
        <div className="portal-header-inner">
          <Brand sub={isInspector ? 'Inspector Portal' : 'Vendor Portal'} to="/" />
          <nav className="portal-nav" aria-label="Main">
            {!isInspector && (
              <NavLink to="/" end className="nav-link">
                <Icon name="layers" /> My Catalogs
              </NavLink>
            )}
            <NavLink to="/inspections" className="nav-link">
              <Icon name="check" /> Inspections
              {waiting > 0 && (
                <span className="nav-count" aria-label={`${waiting} waiting for you`}>
                  {waiting}
                </span>
              )}
            </NavLink>
            <NavLink to="/settings" className="nav-link">
              <Icon name="settings" /> Settings
            </NavLink>
          </nav>
          <div className="portal-user">
            <span className="user-chip">
              <Avatar name={session.user.name} />
              <span className="user-chip-text">
                <strong>{session.user.name}</strong>
                <span>
                  {session.company.name} · {isInspector ? 'Inspector' : 'Vendor / Client'}
                </span>
              </span>
            </span>
            <button type="button" className="btn btn-sm" onClick={logout}>
              <Icon name="logout" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="portal-main" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  )
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <LoginPage
            title="Sign in"
            subtitle="Vendors, clients and inspectors sign in here."
            brandSub="Vendor Portal"
            identifier="username"
            help="Forgot your password? Contact your administrator to reset your password."
            home={HOME}
            isAllowedReturn={isAllowedReturn}
          />
        }
      />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route
          index
          element={
            <ClientOnly>
              <MyCatalogsPage />
            </ClientOnly>
          }
        />
        <Route
          path="listings/:id"
          element={
            <ClientOnly>
              <ListingDetailPage />
            </ClientOnly>
          }
        />
        <Route path="inspections" element={<InspectionsPage />} />
        <Route path="inspections/:id" element={<InspectionPage />} />
        <Route path="inspections/:id/print" element={<InspectionPrintPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* Old link from before Settings existed */}
        <Route path="account" element={<Navigate to="/settings" replace />} />
        <Route
          path="*"
          element={
            <div className="card">
              <div className="state">
                <h2>Page not found</h2>
                <p>That address doesn’t match any page in the portal.</p>
              </div>
            </div>
          }
        />
      </Route>
    </Routes>
  )
}
