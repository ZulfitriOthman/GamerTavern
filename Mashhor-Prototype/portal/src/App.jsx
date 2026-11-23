import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router'
import { RequireAuth } from '@mashoor/shared/AuthProvider'
import { useAuth } from '@mashoor/shared/useAuth'
import { LoginPage } from '@mashoor/shared/LoginPage'
import { Icon } from '@mashoor/shared/Icon'
import { Avatar, Brand } from '@mashoor/shared/ui'
// Existing portal page, reused unchanged: password change.
import SettingsPage from '@legacy-portal/pages/SettingsPage.jsx'
import { InspectionPrintPage } from '@prototype/InspectionPrintPage.jsx'
import { LiveIndicator, LiveProvider } from '@prototype/live.jsx'
import { useLiveVersion } from '@prototype/useLive.js'
// Copy of the existing role-based work lists with a live refetch.
import InspectionsPage from './pages/InspectionsPage.jsx'
import InspectionPage from './pages/InspectionPage.jsx'
import { api, diagramUrl } from './api.js'

// Inspections only: the catalog pages of the existing portal are not part of the prototype.
const HOME = '/inspections'
const RETURNABLE = [/^\/inspections$/, /^\/inspections\/\d{1,15}$/, /^\/inspections\/\d{1,15}\/print$/, /^\/settings$/]
const isAllowedReturn = (pathname) => RETURNABLE.some((pattern) => pattern.test(pathname))
const ROLE_TEXT = { inspector: 'Inspector', client: 'Vendor / Client' }

function Layout() {
  const { session, logout } = useAuth()
  const location = useLocation()
  const [counts, setCounts] = useState(null)
  const isInspector = session.user.role === 'inspector'
  const live = useLiveVersion()

  // Work waiting for this account (badge on Inspections), refreshed on every
  // navigation and on every live inspection update.
  useEffect(() => {
    let cancelled = false
    api('/inspections/counts').then(
      (data) => !cancelled && setCounts(data.counts),
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [location.key, live.version])

  const waiting = counts ? (isInspector ? counts.returned + counts.assigned : counts.pending_verification) + counts.signoffs : 0
  const stages = session.signatoryStages ?? []

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="portal-header">
        <div className="portal-header-inner">
          <Brand sub={isInspector ? 'Inspector Portal' : 'Vendor Portal'} to="/" />
          <span className="proto-tag">Prototype · demo data</span>
          <LiveIndicator />
          <nav className="portal-nav" aria-label="Main">
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
                  {session.company.name} · {ROLE_TEXT[session.user.role] ?? session.user.role}
                  {stages.length > 0 && ` · ${stages.length} sign-off stage${stages.length === 1 ? '' : 's'}`}
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
            subtitle="Inspectors, client verifiers and signatories sign in with their username. Prototype with fictional demo data."
            brandSub="Vendor Portal"
            identifier="username"
            help="Forgot your password? Ask Mashhor staff to reset it."
            home={HOME}
            isAllowedReturn={isAllowedReturn}
          />
        }
      />
      <Route
        element={
          <RequireAuth>
            {/* Live updates for the signed-in session; unmounted (socket closed) on sign-out. */}
            <LiveProvider api={api}>
              <Layout />
            </LiveProvider>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to={HOME} replace />} />
        <Route path="inspections" element={<InspectionsPage />} />
        <Route path="inspections/:id" element={<InspectionPage />} />
        <Route path="inspections/:id/print" element={<InspectionPrintPage api={api} diagramUrl={diagramUrl} />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route
          path="*"
          element={
            <div className="card">
              <div className="state">
                <h2>Page not found</h2>
                <p>That address isn’t part of the inspection portal.</p>
              </div>
            </div>
          }
        />
      </Route>
    </Routes>
  )
}
