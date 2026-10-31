// Symmetric navigation around a centred monogram (desktop) and a full-screen
// menu (phones). Transparent over the hero, frosted ivory once scrolled.
// On the home page the active link follows the section in view.
import { AnimatePresence, motion } from 'motion/react'
import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSite } from '../../context/SiteContext.jsx'
import { useNavItems } from '../../hooks/useSiteSections.js'
import { monogram } from '../../lib/content.js'
import { scrollToHash } from './scrollToHash.js'

/** Which section id is currently in view (home page only). */
function useActiveSection(ids, enabled) {
  const [active, setActive] = useState('home')
  const key = ids.join(',')
  useEffect(() => {
    if (!enabled) return
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (hit) setActive(hit.target.id)
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: [0, 0.25, 0.5] },
    )
    for (const id of key.split(',')) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [key, enabled])
  return active
}

export function Navbar({ overHero, heroTone }) {
  const { content } = useSite()
  const items = useNavItems()
  const { pathname, hash } = useLocation()
  const [openAt, setOpenAt] = useState(null) // the location the menu was opened on; navigating closes it
  const here = pathname + hash
  const open = openAt === here
  const [scrolled, setScrolled] = useState(false)
  const home = pathname === '/'
  const sectionIds = ['home', ...items.filter((i) => i.to.startsWith('/#')).map((i) => i.to.slice(2)), 'rsvp']
  const active = useActiveSection(sectionIds, home)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpenAt(null)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const solid = scrolled || !overHero || open
  const light = !solid && heroTone === 'light' // white text over a hero photo
  const isActive = (to) => (home ? (to === '/' ? active === 'home' : to === `/#${active}`) : to === pathname)

  // Clicking a link to the section you're already on still scrolls to it.
  // When the mobile menu is open, page scrolling is locked until it closes,
  // so the scroll waits a moment for the menu to let go.
  const onNav = (to) => (e) => {
    const [path, h] = to.split('#')
    const samePage = (path || '/') === pathname
    if (!samePage || (!h && to !== '/')) return
    e.preventDefault()
    setOpenAt(null)
    setTimeout(
      () => {
        if (h) {
          scrollToHash(`#${h}`)
          window.history.replaceState(null, '', `${path || '/'}#${h}`)
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      },
      open ? 60 : 0,
    )
  }

  const half = Math.ceil(items.length / 2)
  const link = (item) => (
    <Link
      key={item.to}
      to={item.to}
      onClick={onNav(item.to)}
      aria-current={isActive(item.to) ? 'true' : undefined}
      className={`relative py-2 text-[0.7rem] font-semibold tracking-[0.24em] uppercase transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-center after:transition-transform ${
        light ? 'text-ivory/85 after:bg-champagne hover:text-ivory' : 'text-muted after:bg-gold hover:text-ink'
      } ${isActive(item.to) ? `${light ? 'text-ivory' : 'text-ink'} after:scale-x-100` : 'after:scale-x-0 hover:after:scale-x-100'}`}
    >
      {item.label}
    </Link>
  )

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,border-color] duration-500 ${
        solid ? 'border-b border-linen/80 bg-ivory/85 shadow-[0_8px_30px_-22px_rgb(41_35_31/0.45)] backdrop-blur-md' : 'border-b border-transparent bg-transparent'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <nav className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:h-[4.5rem] sm:px-6" aria-label="Main">
        <div className="hidden items-center justify-end gap-7 lg:flex">{items.slice(0, half).map(link)}</div>
        <div className="lg:hidden" />

        <Link
          to="/"
          onClick={onNav('/')}
          aria-label="Home"
          className={`grid size-11 place-items-center rounded-full border font-display text-sm tracking-[0.12em] transition lg:mx-6 ${
            light ? 'border-ivory/60 text-ivory hover:bg-ivory/10' : 'border-gold/60 text-gold-deep hover:border-gold hover:bg-white'
          }`}
        >
          {monogram(content.couple)}
        </Link>

        <div className="flex items-center justify-end gap-7 lg:justify-start">
          <div className="hidden items-center gap-7 lg:flex">{items.slice(half).map(link)}</div>
          <Link to="/#rsvp" onClick={onNav('/#rsvp')} className={`${light ? 'btn-light' : 'btn-primary'} min-h-9 px-5 text-[0.66rem] lg:ml-2`}>
            RSVP
          </Link>
          <button
            type="button"
            className={`-mr-2 grid size-10 place-items-center rounded-full lg:hidden ${light ? 'text-ivory hover:bg-white/10' : 'text-ink hover:bg-cream'}`}
            onClick={() => setOpenAt(open ? null : here)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="h-[calc(100dvh-4rem)] overflow-y-auto bg-ivory lg:hidden"
            initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
            animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
            exit={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <ul className="flex flex-col items-center gap-1 px-6 pt-10 pb-6">
              {[...items, { to: '/#rsvp', label: 'RSVP' }].map((item, i) => (
                <motion.li key={item.to} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i + 0.12 }}>
                  <Link
                    to={item.to}
                    onClick={onNav(item.to)}
                    aria-current={isActive(item.to) ? 'true' : undefined}
                    className={`block px-6 py-3 font-display text-2xl tracking-[0.16em] uppercase transition ${isActive(item.to) ? 'text-gold-deep' : 'text-ink hover:text-gold-deep'}`}
                  >
                    {item.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
            <div className="mx-auto h-px w-24 bg-gold/40" aria-hidden="true" />
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 px-6 py-6 text-[0.7rem] font-semibold tracking-[0.2em] text-muted uppercase">
              <Link to="/share" className="py-2 hover:text-ink">
                Share photos
              </Link>
              <Link to="/info" className="py-2 hover:text-ink">
                Details &amp; FAQ
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
