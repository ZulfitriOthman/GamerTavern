import { AnimatePresence, motion } from 'motion/react'
import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useSite } from '../../context/SiteContext.jsx'
import { Divider } from '../ui/Ornaments.jsx'
import { navItems } from './navItems.js'

export function Navbar() {
  const { content, settings } = useSite()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const items = navItems(content, settings)
  const rsvpOpen = settings.rsvp_mode !== 'closed'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile menu whenever the route changes.
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setOpen(false)
  }

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const linkCls = ({ isActive }) =>
    `relative px-1 py-2 text-[0.8125rem] font-medium tracking-[0.14em] uppercase transition-colors ${
      isActive ? 'text-ink after:absolute after:inset-x-1 after:-bottom-0.5 after:h-px after:bg-gold' : 'text-muted hover:text-ink'
    }`

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled || open ? 'border-b border-champagne/70 bg-ivory/85 shadow-[0_6px_30px_-20px_rgb(84_66_32/0.35)] backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-ivory">
        Skip to content
      </a>
      <nav className="container-wide flex h-16 items-center justify-between sm:h-20" aria-label="Main">
        <Link to="/" className="font-script text-2xl text-ink sm:text-3xl" aria-label="Home">
          {content.couple.partnerOne.split(' ')[0]} <span className="text-gold-deep">&amp;</span> {content.couple.partnerTwo.split(' ')[0]}
        </Link>

        <div className="hidden items-center gap-6 lg:flex">
          {items
            .filter((i) => !i.mobileOnly)
            .map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkCls}>
                {item.label}
              </NavLink>
            ))}
          {rsvpOpen && (
            <Link to="/rsvp" className="btn-primary btn-sm ml-2">
              RSVP
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          {rsvpOpen && (
            <Link to="/rsvp" className="btn-primary btn-sm">
              RSVP
            </Link>
          )}
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full text-ink hover:bg-cream"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="h-[calc(100dvh-4rem)] overflow-y-auto bg-ivory/97 lg:hidden"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            <ul className="flex flex-col items-center gap-1 px-6 pt-8 pb-12">
              {items.map((item, i) => (
                <motion.li key={item.to} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => `block px-6 py-3 font-serif text-3xl ${isActive ? 'text-gold-deep italic' : 'text-ink'}`}
                  >
                    {item.label}
                  </NavLink>
                </motion.li>
              ))}
              <li className="mt-6 w-full">
                <Divider />
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
