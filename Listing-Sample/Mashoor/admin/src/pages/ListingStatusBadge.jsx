const LABELS = {
  published: ['Published', 'success'],
  draft: ['Unpublished', ''],
  archived: ['Archived', 'warning'],
}

export function ListingStatusBadge({ status }) {
  const [label, tone] = LABELS[status] ?? [status, '']
  return <span className={`badge ${tone}`.trim()}>{label}</span>
}
