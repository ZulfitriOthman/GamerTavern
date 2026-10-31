import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { Ornament } from '../ui/Section.jsx'

export function RouteError() {
  const error = useRouteError()
  console.error('[wedding] route error', error)
  const notFound = isRouteErrorResponse(error) && error.status === 404
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="eyebrow">{notFound ? 'Page not found' : 'Something went wrong'}</p>
        <h1 className="mt-3 text-4xl">{notFound ? 'This page has wandered off' : 'Please try again'}</h1>
        <Ornament className="mt-5" />
        <p className="mt-5 text-muted">{notFound ? 'The link may be incomplete.' : 'An unexpected error occurred while showing this page.'}</p>
        <div className="mt-8 flex justify-center gap-3">
          <button type="button" className="btn-outline" onClick={() => window.location.reload()}>
            Reload
          </button>
          <Link to="/" className="btn-primary">
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
