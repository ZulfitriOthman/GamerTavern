import { Download, Pencil, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState, LoadingBlock, Notice } from '../../components/ui/Feedback.jsx'
import { ConfirmDialog, Modal } from '../../components/ui/Modal.jsx'
import { friendlyError } from '../../lib/errors.js'
import { downloadText, toCsv } from '../../lib/csv.js'
import { useAsync } from '../../hooks/useAsync.js'
import { deleteRsvp, listEvents, listRsvps, updateRsvp } from '../../services/adminService.js'
import { AdminHeader } from '../components/AdminLayout.jsx'
import { Tabs, useAction } from '../components/shared.jsx'

const fmt = (d) => new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
// Replies whose event row was deleted come back with wedding_events = null.
const MISSING = 'missing'
const eventTitle = (r) => r.wedding_events?.title ?? 'Missing Event'

export function RsvpAdmin() {
  const rsvps = useAsync(listRsvps, [])
  const events = useAsync(listEvents, [])
  const [query, setQuery] = useState('')
  const [eventId, setEventId] = useState('all')
  const [status, setStatus] = useState('all')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const { busy, run, feedback } = useAction()

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (rsvps.data ?? []).filter(
      (r) =>
        (eventId === 'all' || (eventId === MISSING ? !r.wedding_events : r.event_id === eventId)) &&
        (status === 'all' || (status === 'yes' ? r.attending : !r.attending)) &&
        (!q || [r.name, r.email, r.phone, r.message, r.invited_guests?.name].some((v) => v?.toLowerCase().includes(q))),
    )
  }, [rsvps.data, query, eventId, status])

  const all = rsvps.data ?? []
  const hasMissing = all.some((r) => !r.wedding_events)
  const totalGuests = rows.filter((r) => r.attending).reduce((n, r) => n + r.party_size, 0)

  const exportCsv = () => {
    const csv = toCsv(rows, [
      { key: 'event', label: 'Event', value: eventTitle },
      { key: 'name', label: 'Name' },
      { key: 'invited', label: 'Invitation', value: (r) => r.invited_guests?.name ?? '' },
      { key: 'attending', label: 'Attending', value: (r) => (r.attending ? 'Yes' : 'No') },
      { key: 'party_size', label: 'Guests' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'message', label: 'Message' },
      { key: 'source', label: 'Source' },
      { key: 'updated_at', label: 'Last updated' },
    ])
    downloadText(`rsvps-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    const attending = editing.attending
    const party = attending ? Math.max(1, Math.min(20, Number(editing.party_size) || 1)) : 0
    const ok = await run(() => updateRsvp(editing.id, { attending, party_size: party, name: editing.name.trim(), message: editing.message || null }), 'RSVP updated.')
    if (ok !== undefined) {
      setEditing(null)
      rsvps.reload()
    }
  }

  const confirmDelete = async () => {
    await run(() => deleteRsvp(deleting.id), 'RSVP deleted.')
    setDeleting(null)
    rsvps.reload()
  }

  return (
    <>
      <AdminHeader title="RSVPs" description={`${rows.length} replies shown · ${totalGuests} attending guests`}>
        <button type="button" className="btn-outline btn-sm" onClick={exportCsv} disabled={!rows.length}>
          <Download className="size-4" /> Export CSV
        </button>
      </AdminHeader>
      {feedback}

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="relative">
          <span className="sr-only">Search</span>
          <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
          <input className="field-input pl-11" placeholder="Search name, email, phone, message…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <select className="field-input" value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Filter by event">
          <option value="all">All events</option>
          {(events.data ?? []).map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.title}
            </option>
          ))}
          {hasMissing && <option value={MISSING}>Missing Event</option>}
        </select>
      </div>
      <Tabs
        value={status}
        onChange={setStatus}
        options={[
          { value: 'all', label: 'All', count: all.length },
          { value: 'yes', label: 'Attending', count: all.filter((r) => r.attending).length },
          { value: 'no', label: 'Declined', count: all.filter((r) => !r.attending).length },
        ]}
      />

      {rsvps.loading ? (
        <LoadingBlock />
      ) : rsvps.error ? (
        <Notice tone="error">{friendlyError(rsvps.error)}</Notice>
      ) : rows.length === 0 ? (
        <EmptyState title="No RSVPs match">Replies will appear here as guests respond.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 rounded-2xl border border-champagne bg-white/70 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-ink">{r.name}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] tracking-wider uppercase ${r.attending ? 'bg-sage-soft text-sage-deep' : 'bg-cream text-muted'}`}>
                    {r.attending ? `Attending · ${r.party_size}` : 'Declined'}
                  </span>
                  <span className={`text-xs ${r.wedding_events ? 'text-gold-deep' : 'text-rose'}`}>{eventTitle(r)}</span>
                  {r.source === 'invite' && <span className="text-[0.65rem] text-muted uppercase">via invite link</span>}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {[r.email, r.phone].filter(Boolean).join(' · ') || 'No contact details'} · {fmt(r.updated_at)}
                </p>
                {r.message && <p className="mt-1.5 text-sm whitespace-pre-line text-muted">“{r.message}”</p>}
              </div>
              <div className="flex gap-1 self-end sm:self-center">
                <button type="button" className="btn-ghost btn-sm px-3" onClick={() => setEditing({ ...r, message: r.message ?? '' })} aria-label={`Edit RSVP from ${r.name}`}>
                  <Pencil className="size-4" />
                </button>
                <button type="button" className="btn-ghost btn-sm px-3 text-rose" onClick={() => setDeleting(r)} aria-label={`Delete RSVP from ${r.name}`}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit RSVP">
        {editing && (
          <form onSubmit={saveEdit} className="space-y-4">
            <label className="block">
              <span className="field-label">Name</span>
              <input className="field-input" value={editing.name} required maxLength={120} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setEditing({ ...editing, attending: v, party_size: v ? Math.max(1, editing.party_size) : 0 })}
                  className={`min-h-11 rounded-2xl border text-sm ${editing.attending === v ? 'border-ink bg-ink text-ivory' : 'border-sand'}`}
                >
                  {v ? 'Attending' : 'Not attending'}
                </button>
              ))}
            </div>
            {editing.attending && (
              <label className="block">
                <span className="field-label">Number of guests</span>
                <input type="number" min={1} max={20} className="field-input" value={editing.party_size} onChange={(e) => setEditing({ ...editing, party_size: e.target.value })} />
              </label>
            )}
            <label className="block">
              <span className="field-label">Message</span>
              <textarea rows={3} maxLength={1000} className="field-input" value={editing.message} onChange={(e) => setEditing({ ...editing, message: e.target.value })} />
            </label>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete RSVP?"
        message={`This permanently removes ${deleting?.name}'s reply for ${deleting ? eventTitle(deleting) : ''}.`}
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}
