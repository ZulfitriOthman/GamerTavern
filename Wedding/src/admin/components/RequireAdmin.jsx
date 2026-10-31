import { Navigate, useLocation } from 'react-router-dom'
import { LoadingBlock } from '../../components/ui/Feedback.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { SetupRequired } from './SetupRequired.jsx'

/**
 * UI gate for the dashboard. This is a convenience only — the real
 * protection is Row Level Security, which rejects non-admin queries.
 */
export function RequireAdmin({ children }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'unavailable') return <SetupRequired />
  if (status === 'loading') return <LoadingBlock label="Checking your access…" />
  if (status !== 'admin') return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  return children
}
