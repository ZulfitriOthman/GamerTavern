import { Download, Pencil, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Checkbox, Field } from '../../components/ui/Field.jsx'
import { EmptyState, LoadError } from '../../components/ui/Feedback.jsx'
import { ConfirmDialog, Modal } from '../../components/ui/Modal.jsx'
import { formatDateTime } from '../../lib/time.js'
import { deleteRsvp, listRsvps, updateRsvp } from '../../services/adminService.js'
import { useAction, useAdminAsync } from '../auth.jsx'
import { ActionStatus, IconBtn, PageTitle, SkeletonRows, StatusPill } from '../components/shared.jsx'
import { downloadCsv } from '../lib.js'

const isYes = (r) => Number(r.attending) === 1 || r.attending === true

export default function RsvpsPage() {
  const { data, loading, error, reload, setData } = useAdminAsync(listRsvps)
  const rsvps = useMemo(() => data ?? [], [data])
  const [query, setQuery] = useState('')
  const [eventId, setEventId] = useState('')
  const [answer, setAnswer] = useState('')
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const action = useAction()

  const events = useMemo(() => {
    const map = new Map()
    for (const r of rsvps) map.set(r.event_id, r.wedding_events?.title ?? 'Event')
    return [...map]
  }, [rsvps])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rsvps.filter(
      (r) =>
        (!eventId || r.event_id === eventId) &&
        (!answer || (answer === 'yes') === isYes(r)) &&
        (!q || [r.name, r.email, r.phone, r.message, r.invited_guests?.name].some((v) => v && String(v).toLowerCase().includes(q))),
    )
  }, [rsvps, query, eventId, answer])

  const totals = shown.reduce((t, r) => (isYes(r) ? { yes: t.yes + 1, guests: t.guests + Number(r.party_size || 0), no: t.no } : { ...t, no: t.no + 1 }), {
    yes: 0,
    no: 0,
    guests: 0,
  })

  const exportCsv = () =>
    downloadCsv(
      `rsvps-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Name', 'Event', 'Attending', 'Guests', 'Email', 'Phone', 'Message', 'Invited guest', 'Source', 'Received'],
      shown.map((r) => [
        r.name,
        r.wedding_events?.title,
        isYes(r) ? 'Yes' : 'No',
        isYes(r) ? r.party_size : 0,
        r.email,
        r.phone,
        r.message,
        r.invited_guests?.name,
        r.source,
        r.created_at ? new Date(r.created_at).toISOString() : '',
      ]),
    )

  const remove = async () => {
    const ok = await action.run(() => deleteRsvp(removing.id), 'Reply deleted.')
    if (ok) {
      setData((list) => list.filter((r) => r.id !== removing.id))
      setRemoving(null)
    }
  }

  return (
    <>
      <PageTitle
        title="RSVPs"
        description="Every reply, per event. Invited guests can update theirs through their personal link."
        actions={
          <button type="button" className="btn-outline" onClick={exportCsv} disabled={!shown.length}>
            <Download className="size-4" aria-hidden="true" /> Export CSV
          </button>
        }
      />
      <ActionStatus error={!removing && !editing ? action.error : ''} notice={action.notice} />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="relative">
          <span className="sr-only">Search replies</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input className="input !pl-10" placeholder="Search name, email, phone or message" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <select className="input sm:w-52" value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Filter by event">
          <option value="">All events</option>
          {events.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
        <select className="input sm:w-44" value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label="Filter by answer">
          <option value="">All answers</option>
          <option value="yes">Attending</option>
          <option value="no">Declined</option>
        </select>
      </div>

      {error && <LoadError message={error} onRetry={reload} />}
      {loading && !data && <SkeletonRows />}
      {data && (
        <>
          <p className="mb-3 text-sm text-muted tabular-nums">
            {shown.length} replies · {totals.yes} attending ({totals.guests} guests) · {totals.no} declined
          </p>
          {shown.length === 0 ? (
            <EmptyState title={rsvps.length ? 'No replies match' : 'No replies yet'}>
              {rsvps.length ? 'Try a different search or filter.' : 'Replies appear here as soon as guests respond.'}
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {shown.map((r) => (
                <li key={r.id} className="card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{r.name}</p>
                        <StatusPill status={isYes(r) ? 'yes' : 'no'}>{isYes(r) ? `Attending · ${r.party_size}` : 'Declined'}</StatusPill>
                        {r.source === 'invite' && <StatusPill status="pending">Invite link</StatusPill>}
                      </div>
                      <p className="mt-0.5 text-sm text-muted">
                        {r.wedding_events?.title}
                        {r.invited_guests?.name && r.invited_guests.name !== r.name && ` · for ${r.invited_guests.name}`}
                      </p>
                      {(r.email || r.phone) && <p className="mt-1 text-sm break-all">{[r.email, r.phone].filter(Boolean).join(' · ')}</p>}
                      {r.message && <p className="mt-2 text-sm whitespace-pre-line text-muted italic">“{r.message}”</p>}
                      <p className="mt-2 text-xs text-muted/80">{formatDateTime(r.updated_at || r.created_at)}</p>
                    </div>
                    <div className="flex">
                      <IconBtn label="Edit reply" icon={Pencil} onClick={() => setEditing(r)} />
                      <IconBtn label="Delete reply" icon={Trash2} danger onClick={() => setRemoving(r)} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {editing && <EditRsvp rsvp={editing} onClose={() => setEditing(null)} onSaved={() => {
            setEditing(null)
            action.setNotice('Reply updated.')
            reload()
          }}
        />}
      <ConfirmDialog open={Boolean(removing)} title="Delete this reply?" busy={action.busy} onConfirm={remove} onClose={() => setRemoving(null)}>
        {removing && (
          <>
            The reply from <strong className="text-ink">{removing.name}</strong> for {removing.wedding_events?.title} will be permanently removed.
            {action.error && <p className="mt-3 text-rose">{action.error}</p>}
          </>
        )}
      </ConfirmDialog>
    </>
  )
}

function EditRsvp({ rsvp, onClose, onSaved }) {
  const [form, setForm] = useState({ name: rsvp.name ?? '', attending: isYes(rsvp), party_size: Number(rsvp.party_size) || 1, message: rsvp.message ?? '' })
  const { busy, error, run } = useAction()
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const save = async (e) => {
    e.preventDefault()
    const ok = await run(() =>
      updateRsvp(rsvp.id, { name: form.name, attending: form.attending, party_size: form.attending ? Number(form.party_size) : 0, message: form.message || null }),
    )
    if (ok) onSaved()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Edit reply"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="edit-rsvp" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="edit-rsvp" onSubmit={save} className="space-y-4">
        <ActionStatus error={error} />
        <p className="text-sm text-muted">{rsvp.wedding_events?.title}</p>
        <Field label="Name" value={form.name} onChange={set('name')} maxLength={120} required />
        <Checkbox label="Attending" checked={form.attending} onChange={set('attending')} />
        {form.attending && <Field label="Number of guests" type="number" min={1} max={20} value={form.party_size} onChange={set('party_size')} />}
        <Field label="Message" as="textarea" value={form.message} onChange={set('message')} maxLength={1000} counter />
      </form>
    </Modal>
  )
}
