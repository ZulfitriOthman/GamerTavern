import { useEffect, useRef, useState } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router'
import { RequireAuth } from '@mashoor/shared/AuthProvider'
import { useAuth } from '@mashoor/shared/useAuth'
import { LoginPage } from '@mashoor/shared/LoginPage'
import { Icon } from '@mashoor/shared/Icon'
import { Avatar, Brand } from '@mashoor/shared/ui'
// Existing admin pages, reused unchanged (they contain no catalog features).
import TemplatesPage from '@legacy-admin/pages/TemplatesPage.jsx'
import TemplateEditorPage from '@legacy-admin/pages/TemplateEditorPage.jsx'
import { InspectionPrintPage } from '@prototype/InspectionPrintPage.jsx'
import { LiveIndicator, LiveProvider } from '@prototype/live.jsx'
// Copies of the existing inspection list and detail pages with a live refetch.
import InspectionsPage from './pages/InspectionsPage.jsx'
import InspectionDetailPage from './pages/InspectionDetailPage.jsx'
// Organisation pages without the legacy catalog (category access) parts.
import VendorsPage from './pages/VendorsPage.jsx'
import VendorPage from './pages/VendorPage.jsx'
import { api, diagramUrl } from './api.js'

// Inspection scope only: the catalog (categories, listings) stays in the
// existing admin site and is not part of this prototype's navigation.
// "Vendors" is the system's current wording for client organisations (handover C7).
const NAV = [
  { to: '/inspections', label: 'Inspections', icon: 'check' },
  { to: '/vendors', label: 'Vendors (organisations)', icon: 'store' },
  { to: '/templates', label: 'Checklist templates', icon: 'edit' },
]

// Sidebar layout from the existing admin site. Below 960px the sidebar is an
// off-canvas drawer opened from the top bar.
function Layout() {
  const { session, logout } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const menuButton = useRef(null)
  const sidebar = useRef(null)

  const [routeKey, setRouteKey] = useState(location.key)
  if (routeKey !== location.key) {
    setRouteKey(location.key)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return undefined
    sidebar.current?.querySelector('a, button')?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        menuButton.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="mobile-bar">
        <Brand sub="Inspections Admin" to="/" />
        <button
          ref={menuButton}
          type="button"
          className="btn btn-icon"
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls="admin-sidebar"
          onClick={() => setOpen(true)}
        >
          <Icon name="menu" />
        </button>
      </div>
      {open && <button type="button" className="sidebar-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
      <aside id="admin-sidebar" ref={sidebar} className={`sidebar${open ? ' open' : ''}`} aria-label="Admin">
        <div className="sidebar-head">
          <Brand sub="Inspections Admin" to="/" />
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon sidebar-close"
            aria-label="Close navigation"
            onClick={() => {
              setOpen(false)
              menuButton.current?.focus()
            }}
          >
            <Icon name="close" />
          </button>
        </div>
        <nav className="nav-section" aria-label="Main">
          <span className="nav-label">
            Manage <span className="proto-tag">Prototype · demo data</span>
          </span>
          <span className="nav-label">
            <LiveIndicator />
          </span>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className="nav-link">
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <Avatar name={session.user.name} />
            <span className="user-chip-text">
              <strong>{session.user.name}</strong>
              <span>{session.user.email}</span>
            </span>
          </div>
          <button type="button" className="btn btn-sm" onClick={logout}>
            <Icon name="logout" /> Sign out
          </button>
        </div>
      </aside>
      <main id="main" className="admin-main" tabIndex={-1}>
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <LoginPage
            title="Staff sign in"
            subtitle="Mashhor vehicle inspections — staff sign in with their email address. Prototype with fictional demo data."
            brandSub="Inspections Admin"
            home="/inspections"
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
        <Route index element={<Navigate to="/inspections" replace />} />
        <Route path="inspections" element={<InspectionsPage />} />
        <Route path="inspections/:id" element={<InspectionDetailPage />} />
        <Route path="inspections/:id/print" element={<InspectionPrintPage api={api} diagramUrl={diagramUrl} />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="vendors/:id" element={<VendorPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        {/* Distinct keys: going from "new" to the created template must remount the editor. */}
        <Route path="templates/new" element={<TemplateEditorPage key="new" />} />
        <Route path="templates/:id" element={<TemplateEditorPage key="edit" />} />
        <Route
          path="*"
          element={
            <div className="card">
              <div className="state">
                <h2>Page not found</h2>
                <p>That address isn’t part of the inspection prototype.</p>
              </div>
            </div>
          }
        />
      </Route>
    </Routes>
  )
}
