import { Database } from 'lucide-react'
import { Link } from 'react-router-dom'

/** Shown when the dashboard cannot reach the wedding API. */
export function SetupRequired() {
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <div className="card max-w-lg p-8 sm:p-10">
        <Database className="size-8 text-gold" strokeWidth={1.3} />
        <h1 className="mt-4 text-3xl">Server not reachable</h1>
        <p className="mt-3 text-sm text-muted">The dashboard could not reach the wedding API. Nothing can be managed until it is running.</p>
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>
            Run the SQL scripts in <code>Wedding/database</code> (see its README).
          </li>
          <li>
            Configure <code>Wedding/server/.env</code> from <code>.env.example</code> and start it with <code>npm run dev</code>.
          </li>
          <li>
            Create your admin account: <code>npm run create-admin -- --email you@example.com</code>.
          </li>
          <li>Reload this page.</li>
        </ol>
        <Link to="/" className="btn-outline mt-8">
          Back to website
        </Link>
      </div>
    </div>
  )
}
