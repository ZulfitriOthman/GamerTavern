import { Ban, Check, EyeOff, Heart, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, LoadError } from '../../components/ui/Feedback.jsx'
import { ConfirmDialog } from '../../components/ui/Modal.jsx'
import { formatDateTime } from '../../lib/time.js'
import { deleteWish, listWishes, setWishStatus } from '../../services/adminService.js'
import { useAction, useAdminAsync } from '../auth.jsx'
import { ActionStatus, IconBtn, PageTitle, SkeletonRows, StatusPill, Tabs } from '../components/shared.jsx'

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'approved', label: 'Visible' },
  { value: 'pending', label: 'Pending' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'spam', label: 'Spam' },
]

const DONE = { approved: 'Wish is now visible.', hidden: 'Wish hidden from guests.', spam: 'Marked as spam and hidden.' }

export default function WishesPage() {
  const [filter, setFilter] = useState('')
  const { data, loading, error, reload, setData } = useAdminAsync(() => listWishes(filter), [filter])
  const [removing, setRemoving] = useState(null)
  const action = useAction()

  const setStatus = async (wish, status) => {
    if (await action.run(() => setWishStatus(wish.id, status), DONE[status])) {
      setData((list) => (filter && filter !== status ? list.filter((w) => w.id !== wish.id) : list.map((w) => (w.id === wish.id ? { ...w, status } : w))))
    }
  }

  const remove = async () => {
    if (await action.run(() => deleteWish(removing.id), 'Wish deleted.')) {
      setData((list) => list.filter((w) => w.id !== removing.id))
      setRemoving(null)
    }
  }

  return (
    <>
      <PageTitle title="Wishes" description="Messages from the guestbook. Only visible wishes appear on the website." />
      <ActionStatus error={!removing ? action.error : ''} notice={action.notice} />
      <Tabs tabs={FILTERS} value={filter} onChange={setFilter} label="Filter wishes" />

      {error && <LoadError message={error} onRetry={reload} />}
      {loading && !data && <SkeletonRows />}
      {data &&
        (data.length === 0 ? (
          <EmptyState icon={Heart} title="No wishes here">
            {filter ? 'Nothing with this status.' : 'Wishes appear here as guests write them.'}
          </EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {data.map((w) => (
              <li key={w.id} className="card flex flex-col p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{w.name}</p>
                  {w.relationship && <span className="text-xs text-muted">· {w.relationship}</span>}
                  <StatusPill status={w.status} />
                </div>
                <p className="mt-2 flex-1 text-sm leading-relaxed break-words whitespace-pre-line">{w.message}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted/80">{formatDateTime(w.created_at)}</span>
                  <div className="flex">
                    {w.status !== 'approved' && <IconBtn label="Approve" icon={Check} onClick={() => setStatus(w, 'approved')} />}
                    {w.status !== 'hidden' && <IconBtn label="Hide" icon={EyeOff} onClick={() => setStatus(w, 'hidden')} />}
                    {w.status !== 'spam' && <IconBtn label="Mark as spam" icon={Ban} onClick={() => setStatus(w, 'spam')} />}
                    <IconBtn label="Delete" icon={Trash2} danger onClick={() => setRemoving(w)} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ))}

      <ConfirmDialog open={Boolean(removing)} title="Delete this wish?" busy={action.busy} onConfirm={remove} onClose={() => setRemoving(null)}>
        {removing && (
          <>
            The wish from <strong className="text-ink">{removing.name}</strong> will be permanently deleted. To keep a record, hide it or mark it as spam instead.
            {action.error && <p className="mt-3 text-rose">{action.error}</p>}
          </>
        )}
      </ConfirmDialog>
    </>
  )
}
