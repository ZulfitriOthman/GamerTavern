import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/Section.jsx'

export default function NotFoundPage() {
  return (
    <>
      <PageHeader eyebrow="Page not found" title="This page has wandered off">
        <p>The link may be incomplete or the page may have moved.</p>
      </PageHeader>
      <div className="text-center">
        <Link to="/" className="btn-primary">
          Back to home
        </Link>
      </div>
    </>
  )
}
