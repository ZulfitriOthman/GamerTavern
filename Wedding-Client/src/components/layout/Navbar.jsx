// Links either side of a centred "N & S" monogram (desktop) and a full-screen menu
// (phones). Lightly frosted at the top, more opaque once scrolled. The active
// link follows the section in view.
import { AnimatePresence, motion } from 'motion/react'
import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { weddingData } from '../../data/weddingData.js'
import { coupleMonogram, coupleShort } from '../../lib/content.js'
import { NAV_ITEMS, SECTION_IDS } from './navItems.js'
import { scrollToHash } from './scrollToHash.js'

/** Which section is in view. Sections without their own link light up the nearest earlier link. */
function useActiveSection() {
  const [active, setActive] = useState('utama')
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (hit) setActive(hit.target.id)
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: [0, 0.25, 0.5] },
    )
    for (const id of SECTION_IDS) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])
  return active
}

const linkFor = (active) => {
  const linked = NAV_ITEMS.map((i) => i.href.slice(1))
  const order = SECTION_IDS.slice(0, SECTION_IDS.indexOf(active) + 1).reverse()
  return `#${order.find((id) => linked.includes(id)) ?? 'utama'}`
}

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const active = useActiveSection()
  const current = linkFor(active)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  // Smooth in-page scrolling; waits for the mobile menu to release the page first.
  const go = (href) => (e) => {
    e.preventDefault()
    const wasOpen = open
    setOpen(false)
    setTimeout(() => {
      scrollToHash(href)
      window.history.replaceState(null, '', href === '#utama' ? window.location.pathname : href)
    }, wasOpen ? 60 : 0)
  }

  const half = Math.ceil(NAV_ITEMS.length / 2)
  const link = (item) => (
    <a
      key={item.href}
      href={item.href}
      onClick={go(item.href)}
      aria-current={current === item.href ? 'true' : undefined}
      className={`relative py-2 font-display text-[0.72rem] font-medium tracking-[0.22em] uppercase transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-center after:bg-floral after:transition-transform ${
        current === item.href ? 'text-primary after:scale-x-100' : 'text-muted after:scale-x-0 hover:text-ink hover:after:scale-x-100'
      }`}
    >
      {item.label}
    </a>
  )

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 backdrop-blur-md transition-[background-color,box-shadow,border-color] duration-500 ${
        scrolled || open ? 'border-b border-line/80 bg-ivory/90 shadow-[0_8px_30px_-22px_rgb(52_31_41/0.3)]' : 'border-b border-transparent bg-ivory/40'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <nav className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:h-[4.5rem] sm:px-6" aria-label="Navigasi utama">
        <div className="hidden items-center justify-end gap-7 lg:flex">{NAV_ITEMS.slice(0, half).map(link)}</div>
        <div className="lg:hidden" />

        <a
          href="#utama"
          onClick={go('#utama')}
          aria-label={`${coupleShort(weddingData.couple)}: kembali ke atas`}
          className="grid size-11 place-items-center rounded-full border border-bronze/50 bg-white/70 font-serif text-[0.95rem] leading-none whitespace-nowrap text-primary italic transition hover:border-primary/50 hover:bg-white lg:mx-6"
        >
          <span aria-hidden="true">{coupleMonogram(weddingData.couple).replace(/ & /, '&')}</span>
        </a>

        <div className="flex items-center justify-end gap-7 lg:justify-start">
          <div className="hidden items-center gap-7 lg:flex">{NAV_ITEMS.slice(half).map(link)}</div>
          <button
            type="button"
            className="-mr-2 grid size-10 place-items-center rounded-full text-ink hover:bg-mist lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Tutup menu' : 'Buka menu'}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="bg-geometric h-[calc(100dvh-4rem)] overflow-y-auto bg-ivory lg:hidden"
            initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
            animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
            exit={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <ul className="flex flex-col items-center gap-1 px-6 py-10">
              {NAV_ITEMS.map((item, i) => (
                <motion.li key={item.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i + 0.12 }}>
                  <a
                    href={item.href}
                    onClick={go(item.href)}
                    aria-current={current === item.href ? 'true' : undefined}
                    className={`block px-6 py-3 font-display text-2xl tracking-[0.12em] uppercase transition ${current === item.href ? 'text-primary' : 'text-ink/80 hover:text-primary'}`}
                  >
                    {item.label}
                  </a>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
