import { CalendarHeart, ExternalLink, Heart, Images, LayoutDashboard, LogOut, MailCheck, Settings, Users } from 'lucide-react'
import { NavLink, Link } from 'react-router-dom'
import { useSite } from '../../context/SiteContext.jsx'
import { monogram, siteTitle } from '../../lib/content.js'
import { useAuth } from '../auth.jsx'

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/rsvps', label: 'RSVPs', icon: MailCheck },
  { to: '/admin/guests', label: 'Guests', icon: Users },
  { to: '/admin/photos', label: 'Photos', icon: Images },
  { to: '/admin/wishes', label: 'Wishes', icon: Heart },
  { to: '/admin/events', label: 'Events', icon: CalendarHeart },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

export function AdminLayout({ children }) {
  const { admin, logout } = useAuth()
  const { content, events } = useSite()
  const title = siteTitle(content, events)

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-champagne/80 bg-white/55 backdrop-blur lg:flex">
        <div className="flex items-center gap-3 border-b border-champagne/70 px-6 py-6">
          <span className="grid size-11 place-items-center rounded-full border border-gold/60 font-serif text-lg text-gold-deep">{monogram(content.couple)}</span>
          <div className="min-w-0">
            <p className="truncate font-serif text-lg leading-tight">{title}</p>
            <p className="eyebrow !text-[0.6rem] !tracking-[0.24em]">Wedding dashboard</p>
          </div>
        </div>
        <nav aria-label="Dashboard" className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition ${isActive ? 'bg-ink text-ivory shadow-soft' : 'text-muted hover:bg-cream hover:text-ink'}`
              }
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t border-champagne/70 p-3 text-sm">
          <Link to="/" target="_blank" rel="noopener" className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-muted hover:bg-cream hover:text-ink">
            <ExternalLink className="size-4" aria-hidden="true" /> View site
          </Link>
          <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-muted hover:bg-cream hover:text-ink">
            <LogOut className="size-4" aria-hidden="true" /> Sign out
          </button>
          <p className="truncate px-4 pt-1 text-xs text-muted/80">{admin?.displayName || admin?.email}</p>
        </div>
      </aside>

      {/* Mobile header + scrollable tab bar */}
      <header className="sticky top-0 z-30 border-b border-champagne/80 bg-ivory/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full border border-gold/60 font-serif text-gold-deep">{monogram(content.couple)}</span>
            <p className="truncate font-serif text-lg">Dashboard</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Link to="/" target="_blank" rel="noopener" className="rounded-full p-2 text-muted hover:bg-cream" aria-label="View site">
              <ExternalLink className="size-5" />
            </Link>
            <button type="button" onClick={logout} className="rounded-full p-2 text-muted hover:bg-cream" aria-label="Sign out">
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
        <nav aria-label="Dashboard" className="scrollbar-none flex gap-1 overflow-x-auto px-3 pb-2.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition ${isActive ? 'bg-ink text-ivory' : 'text-muted hover:bg-cream'}`
              }
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}
