import { useEffect, useState } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { useSite } from '../../context/SiteContext.jsx'
import { siteTitle } from '../../lib/content.js'
import { LoadError } from '../ui/Feedback.jsx'
import { Footer } from './Footer.jsx'
import { Navbar } from './Navbar.jsx'
import { scrollToHash } from './scrollToHash.js'

export function PublicLayout() {
  const { status, error, retry, content, events } = useSite()
  const { pathname, hash } = useLocation()
  // The hero reports whether its text is light (over a photo) or dark, so the navbar matches it.
  const [heroTone, setHeroTone] = useState('light')
  const names = siteTitle(content, events)

  useEffect(() => {
    if (status === 'ready') document.title = `${names} · Wedding`
  }, [status, names])

  // /#section links: scroll once the section exists (it may render after the site data loads).
  useEffect(() => {
    if (!hash) return
    let tries = 0
    const t = setInterval(() => (scrollToHash(hash) || ++tries > 20) && clearInterval(t), 100)
    return () => clearInterval(t)
  }, [pathname, hash, status])

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <a href="#main" className="sr-only z-[60] rounded-full bg-ink px-4 py-2 text-ivory focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <Navbar overHero={pathname === '/'} heroTone={heroTone} />
      {status === 'error' && (
        <div className="fixed inset-x-3 top-20 z-40 mx-auto max-w-lg">
          <LoadError
            message={
              import.meta.env.DEV
                ? `${error} (Development: start this site’s API with “npm run dev:api” on port 4101 — see README.)`
                : error
            }
            onRetry={retry}
          />
        </div>
      )}
      <main id="main" className="flex-1">
        <Outlet context={{ setHeroTone }} />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  )
}
