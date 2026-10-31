import { Link } from 'react-router-dom'
import { Divider, Sprig } from '../components/ui/Ornaments.jsx'

export function NotFoundPage() {
  return (
    <div className="relative flex min-h-[80vh] flex-col items-center justify-center px-6 pt-24 text-center">
      <Sprig className="h-32" />
      <h1 className="mt-6 text-5xl">Page not found</h1>
      <Divider className="mt-5" />
      <p className="mt-5 max-w-sm text-muted">The page you are looking for has wandered off. Let us take you back.</p>
      <Link to="/" className="btn-primary mt-8">
        Back to home
      </Link>
    </div>
  )
}
