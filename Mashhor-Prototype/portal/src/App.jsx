import { useEffect, useRef, useState } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router'
import { RequireAuth } from '@mashoor/shared/AuthProvider'
import { useAuth } from '@mashoor/shared/useAuth'
import { LoginPage } from '@mashoor/shared/LoginPage'
import { Icon } from '@mashoor/shared/Icon'
import { Avatar, Brand } from '@mashoor/shared/ui'
// Existing portal page, reused unchanged: password change.
import SettingsPage from '@legacy-portal/pages/SettingsPage.jsx'
import { InspectionPrintPage } from '@prototype/InspectionPrintPage.jsx'
import { LiveProvider } from '@prototype/live.jsx'
import { useLiveVersion } from '@prototype/useLive.js'
// Copy of the existing role-based work lists with a live refetch.
import InspectionsPage from './pages/InspectionsPage.jsx'
import InspectionPage from './pages/InspectionPage.jsx'
import { api, diagramUrl } from './api.js'

// Inspections only: the catalog pages of the existing portal are not part of the prototype.
const HOME = '/inspections'
const RETURNABLE = [/^\/inspections$/, /^\/inspections\/\d{1,15}$/, /^\/inspections\/\d{1,15}\/print$/, /^\/settings$/]
const isAllowedReturn = (pathname) => RETURNABLE.some((pattern) => pattern.test(pathname))
const ROLE_TEXT = { inspector: 'Inspector', client: 'Client' }

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

  // The account menu is a native popover; close it once a link inside it navigates.
  const menu = useRef(null)
  useEffect(() => {
    if (menu.current?.matches(':popover-open')) menu.current.hidePopover()
  }, [location.key])

  // Same queues as TODO in pages/InspectionsPage.jsx (the amber tab counts).
  const waiting = counts ? (isInspector ? counts.assigned + counts.draft + counts.returned : counts.pending_verification) + counts.signoffs : 0
  const stages = session.signatoryStages ?? []

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="portal-header">
        <div className="portal-header-inner">
          <Brand sub={isInspector ? 'Inspector Portal' : 'Client Portal'} to="/" />
          <nav className="portal-nav" aria-label="Main">
            <NavLink to="/inspections" className="nav-link">
              Inspections
              {waiting > 0 && (
                <span className="nav-count" aria-label={`${waiting} waiting for you`}>
                  {waiting}
                </span>
              )}
            </NavLink>
          </nav>
          <div className="portal-user">
            <span className="proto-tag">Prototype · demo data</span>
            <button type="button" className="proto-account" popoverTarget="portal-menu" aria-label={`Account: ${session.user.name}`}>
              <Avatar name={session.user.name} />
              <span className="proto-account-name">{session.user.name}</span>
              <Icon name="next" className="proto-account-caret" />
            </button>
            <div id="portal-menu" ref={menu} className="proto-menu" popover="auto">
              <div className="proto-menu-head">
                <strong>{session.user.name}</strong>
                <span>{session.company.name}</span>
                <span>
                  {ROLE_TEXT[session.user.role] ?? session.user.role}
                  {stages.length > 0 && ` · ${stages.length} sign-off stage${stages.length === 1 ? '' : 's'}`}
                </span>
              </div>
              <NavLink to="/settings" className="proto-menu-item">
                <Icon name="settings" /> Settings
              </NavLink>
              <button type="button" className="proto-menu-item" onClick={logout}>
                <Icon name="logout" /> Sign out
              </button>
            </div>
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
            brandSub="Inspector & Client Portal"
            identifier="username"
            help="Forgot your password? Ask the Mashhor office to reset it."
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
