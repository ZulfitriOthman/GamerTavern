// Account / company / category status. Inactive states default to the red
// tone (suspended, deactivated); pass inactiveTone="neutral" for softer ones.
export function StatusBadge({ active, activeLabel = 'Active', inactiveLabel = 'Inactive', inactiveTone = 'danger' }) {
  return <span className={`badge ${active ? 'success' : inactiveTone}`}>{active ? activeLabel : inactiveLabel}</span>
}
