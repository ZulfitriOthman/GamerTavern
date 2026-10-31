import { Check, EyeOff, ShieldAlert, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, LoadingBlock, Notice } from '../../components/ui/Feedback.jsx'
import { ConfirmDialog } from '../../components/ui/Modal.jsx'
import { friendlyError } from '../../lib/errors.js'
import { useAsync } from '../../hooks/useAsync.js'
import { deleteGreeting, listGreetings, setGreetingStatus } from '../../services/adminService.js'
import { AdminHeader } from '../components/AdminLayout.jsx'
import { Tabs, useAction } from '../components/shared.jsx'

const STATUS_STYLE = {
  pending: 'bg-champagne text-gold-deep',
  approved: 'bg-sage-soft text-sage-deep',
  hidden: 'bg-cream text-muted',
  spam: 'bg-rose/10 text-rose',
}

export function GreetingsAdmin() {
  const [status, setStatus] = useState('all')
  const list = useAsync(() => listGreetings(status), [status])
  const [deleting, setDeleting] = useState(null)
  const { busy, run, feedback } = useAction()

  const act = async (g, next) => {
    await run(() => setGreetingStatus(g.id, next))
    list.reload()
  }

  return (
    <>
      <AdminHeader title="Wishes" description="New wishes appear on the website immediately. Hide, mark as spam or delete anything inappropriate here." />
      {feedback}
      <Tabs
        value={status}
        onChange={setStatus}
        options={[
          { value: 'all', label: 'All' },
          { value: 'approved', label: 'Published' },
          { value: 'hidden', label: 'Hidden' },
          { value: 'spam', label: 'Spam' },
          { value: 'pending', label: 'Pending (old)' },
        ]}
      />

      {list.loading ? (
        <LoadingBlock />
      ) : list.error ? (
        <Notice tone="error">{friendlyError(list.error)}</Notice>
      ) : list.data.length === 0 ? (
        <EmptyState title={status === 'pending' ? 'All caught up' : 'Nothing here'}>
          {status === 'pending' ? 'New wishes will appear here for review.' : 'Try another filter.'}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {list.data.map((g) => (
            <li key={g.id} className="flex flex-col rounded-2xl border border-champagne bg-white/70 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-ink">{g.name}</p>
                {g.relationship && <span className="text-xs text-muted">· {g.relationship}</span>}
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[0.6rem] tracking-wider uppercase ${STATUS_STYLE[g.status]}`}>{g.status === 'approved' ? 'published' : g.status === 'pending' ? 'pending (old)' : g.status}</span>
              </div>
              <p className="mt-2 flex-1 text-sm whitespace-pre-line text-muted">{g.message}</p>
              <p className="mt-2 text-[0.65rem] text-muted/80">{new Date(g.created_at).toLocaleString()}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {g.status !== 'approved' && (
                  <button type="button" className="btn btn-sm bg-sage-deep text-white" onClick={() => act(g, 'approved')} disabled={busy}>
                    <Check className="size-3.5" /> Publish
                  </button>
                )}
                {g.status !== 'hidden' && (
                  <button type="button" className="btn-outline btn-sm" onClick={() => act(g, 'hidden')} disabled={busy}>
                    <EyeOff className="size-3.5" /> Hide
                  </button>
                )}
                {g.status !== 'spam' && (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => act(g, 'spam')} disabled={busy}>
                    <ShieldAlert className="size-3.5" /> Spam
                  </button>
                )}
                <button type="button" className="btn-ghost btn-sm text-rose" onClick={() => setDeleting(g)} disabled={busy}>
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this wish?"
        message="It will be permanently removed. (Tip: marking it as spam keeps it hidden and also blocks the identical message from being resubmitted.)"
        busy={busy}
        onConfirm={async () => {
          await run(() => deleteGreeting(deleting.id), 'Wish deleted.')
          setDeleting(null)
          list.reload()
        }}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}
