import { RotateCw } from 'lucide-react'
import { useEffect } from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { Divider, Sprig } from '../ui/Ornaments.jsx'

// Errors that mean "this tab is running out-of-date code" (a new build or a
// restarted dev server replaced the JavaScript files). A reload fixes them.
const STALE_CODE_RE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Cannot read properties of null \(reading 'use[A-Z]/i

function isStaleCodeError(error) {
  return STALE_CODE_RE.test(String(error?.message ?? error ?? ''))
}

/**
 * Route-level error screen (React Router `errorElement`). Guests see a calm,
 * on-theme message and a reload button — never a stack trace. Details are
 * logged to the console in development only.
 */
export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  const stale = isStaleCodeError(error)

  useEffect(() => {
    if (import.meta.env.DEV) console.error('[wedding] route error', error)
  }, [error])

  return (
    <div className="hero-wash relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <Sprig className="absolute -bottom-10 -left-8 h-56 -rotate-12 opacity-40" />
      <Sprig className="absolute -top-12 -right-6 h-48 rotate-[160deg] opacity-30" bloom={false} />
      <p className="eyebrow">Zulfitri &amp; Mariah</p>
      <h1 className="mt-4 text-4xl sm:text-5xl">{notFound ? 'Page not found' : 'Something went wrong'}</h1>
      <Divider className="mt-5" />
      <p className="mt-5 max-w-md text-muted">
        {notFound
          ? 'The page you are looking for does not exist.'
          : stale
            ? 'The website was just updated. Please reload the page to see the latest version.'
            : 'We could not show this page. Please reload, or try again in a moment.'}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {!notFound && (
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            <RotateCw className="size-4" /> Reload page
          </button>
        )}
        <Link to="/" reloadDocument className="btn-outline">
          Back to home
        </Link>
      </div>
      {import.meta.env.DEV && error instanceof Error && (
        <pre className="mt-10 max-w-2xl overflow-x-auto rounded-2xl bg-ink/90 p-4 text-left text-xs text-ivory/90">{error.message}</pre>
      )}
    </div>
  )
}
