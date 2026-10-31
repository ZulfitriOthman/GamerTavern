import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useSite } from '../../context/SiteContext.jsx'
import { BackgroundMusic } from '../BackgroundMusic.jsx'
import { EnvelopeIntro, envelopeWillShow } from '../home/EnvelopeIntro.jsx'
import { Notice } from '../ui/Feedback.jsx'
import { Footer } from './Footer.jsx'
import { Navbar } from './Navbar.jsx'

export function PublicLayout() {
  const { pathname } = useLocation()
  const { status, content, coupleTitle, refresh } = useSite()
  const [retrying, setRetrying] = useState(false)

  // One request per click — no automatic retry loop hammering an unavailable server.
  const retry = async () => {
    setRetrying(true)
    await refresh()
    setRetrying(false)
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  useEffect(() => {
    document.title = `${coupleTitle} 💍`
  }, [coupleTitle])

  if (status === 'loading') {
    return (
      <div className="hero-wash grid min-h-dvh place-items-center" role="status" aria-label="Loading">
        <div className="size-14 animate-pulse rounded-full border border-gold/60 motion-reduce:animate-none" />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* The envelope greets guests on the invitation page, not on deep links like /share. */}
      {pathname === '/' && <EnvelopeIntro />}
      <Navbar />
      {/* No envelope on this visit (disabled, already opened, or a deep link): offer the choice instead. */}
      <BackgroundMusic offerChoice={!(pathname === '/' && envelopeWillShow(content))} />
      {status === 'error' && (
        <div className="container-narrow fixed inset-x-0 bottom-4 z-40 max-sm:pr-20">
          <Notice tone="error" title="Some details could not be loaded">
            The website could not reach its server. The invitation details below are shown, but RSVPs, wishes and photos are unavailable for now.
            <button type="button" onClick={retry} disabled={retrying} className="btn-outline btn-sm mt-3 flex">
              {retrying ? 'Trying again…' : 'Try again'}
            </button>
          </Notice>
        </div>
      )}
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
