import { CalendarDays, ExternalLink, Heart, Images, LayoutDashboard, ListChecks, LogOut, Settings, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useSite } from '../../context/SiteContext.jsx'

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/rsvps', label: 'RSVPs', icon: ListChecks },
  { to: '/admin/guests', label: 'Guests', icon: Users },
  { to: '/admin/photos', label: 'Photos', icon: Images },
  { to: '/admin/wishes', label: 'Wishes', icon: Heart },
  { to: '/admin/events', label: 'Events', icon: CalendarDays },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

export function AdminLayout() {
  const { user, signOut } = useAuth()
  const { coupleTitle } = useSite()

  return (
    <div className="min-h-dvh bg-ivory lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 z-40 border-b border-champagne bg-ivory/95 backdrop-blur lg:h-dvh lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-4 py-3 lg:block lg:px-6 lg:py-8">
          <div>
            <p className="font-script text-2xl text-ink lg:text-3xl">{coupleTitle}</p>
            <p className="hidden text-[0.65rem] tracking-[0.2em] text-muted uppercase lg:block">Wedding dashboard</p>
          </div>
          <div className="flex items-center gap-1 lg:hidden">
            <a href="/" target="_blank" rel="noreferrer" className="btn-ghost btn-sm px-3" aria-label="View website">
              <ExternalLink className="size-4" />
            </a>
            <button type="button" onClick={() => signOut()} className="btn-ghost btn-sm px-3" aria-label="Sign out">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-2 lg:flex-col lg:px-4">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive ? 'bg-ink text-ivory' : 'text-muted hover:bg-cream hover:text-ink'
                }`
              }
            >
              <Icon className="size-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute inset-x-0 bottom-0 hidden space-y-2 border-t border-champagne p-4 lg:block">
          <p className="truncate text-xs text-muted" title={user?.email}>
            {user?.email}
          </p>
          <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-muted hover:text-ink">
            <ExternalLink className="size-4" /> View website
          </a>
          <button type="button" onClick={() => signOut()} className="flex items-center gap-2 text-sm text-muted hover:text-ink">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 lg:py-10">
        <Outlet />
      </main>
    </div>
  )
}

export function AdminHeader({ title, description, children }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-4xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}
