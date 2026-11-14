import { useEffect, useRef, useState } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router'
import { RequireAuth } from '@mashoor/shared/AuthProvider'
import { useAuth } from '@mashoor/shared/useAuth'
import { LoginPage } from '@mashoor/shared/LoginPage'
import { Icon } from '@mashoor/shared/Icon'
import { Avatar, Brand } from '@mashoor/shared/ui'
import DashboardPage from './pages/DashboardPage.jsx'
import VendorsPage from './pages/VendorsPage.jsx'
import VendorDetailPage from './pages/VendorDetailPage.jsx'
import CategoriesPage from './pages/CategoriesPage.jsx'
import ListingsPage from './pages/ListingsPage.jsx'
import ListingFormPage from './pages/ListingFormPage.jsx'
import InspectionsPage from './pages/InspectionsPage.jsx'
import InspectionDetailPage from './pages/InspectionDetailPage.jsx'
import TemplatesPage from './pages/TemplatesPage.jsx'
import TemplateEditorPage from './pages/TemplateEditorPage.jsx'
import InspectionPrintPage from './pages/InspectionPrintPage.jsx'

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/vendors', label: 'Vendors', icon: 'store' },
  { to: '/categories', label: 'Categories', icon: 'tag' },
  { to: '/listings', label: 'Catalog listings', icon: 'layers' },
  { to: '/inspections', label: 'Inspections', icon: 'check' },
  { to: '/templates', label: 'Checklist templates', icon: 'edit' },
]

// Sidebar layout (pattern reference: 21st.dev wensity/sidebar — labelled nav
// section, icon + label items, user in the footer). Below 960px the sidebar is
// an off-canvas drawer opened from the top bar.
function Layout() {
  const { session, logout } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const menuButton = useRef(null)
  const sidebar = useRef(null)

  // Close the drawer whenever the route changes.
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
        <Brand sub="Admin" to="/" />
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
          <Brand sub="Admin" to="/" />
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
          <span className="nav-label">Manage</span>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
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
        element={<LoginPage title="Staff sign in" subtitle="Manage vendors, categories and catalog listings." brandSub="Admin" />}
      />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="vendors/:id" element={<VendorDetailPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="listings" element={<ListingsPage />} />
        {/* Distinct keys: going from "new" to the created listing must remount the form. */}
        <Route path="listings/new" element={<ListingFormPage key="new" />} />
        <Route path="listings/:id" element={<ListingFormPage key="edit" />} />
        <Route path="inspections" element={<InspectionsPage />} />
        <Route path="inspections/:id" element={<InspectionDetailPage />} />
        <Route path="inspections/:id/print" element={<InspectionPrintPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="templates/new" element={<TemplateEditorPage key="new" />} />
        <Route path="templates/:id" element={<TemplateEditorPage key="edit" />} />
        {/* Old link from before catalog listings existed */}
        <Route path="catalogs" element={<Navigate to="/listings" replace />} />
        <Route
          path="*"
          element={
            <div className="card">
              <div className="state">
                <h2>Page not found</h2>
                <p>That address doesn’t match any admin page.</p>
              </div>
            </div>
          }
        />
      </Route>
    </Routes>
  )
}
