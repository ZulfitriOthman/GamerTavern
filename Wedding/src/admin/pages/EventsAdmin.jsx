import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, LoadingBlock, Notice } from '../../components/ui/Feedback.jsx'
import { ConfirmDialog, Modal } from '../../components/ui/Modal.jsx'
import { useSite } from '../../context/SiteContext.jsx'
import { friendlyError } from '../../lib/errors.js'
import { formatDate, formatTimeRange } from '../../lib/time.js'
import { useAsync } from '../../hooks/useAsync.js'
import { deleteEvent, listEvents, saveEvent } from '../../services/adminService.js'
import { AdminHeader } from '../components/AdminLayout.jsx'
import { ListEditor, Toggle, useAction } from '../components/shared.jsx'

const EMPTY = {
  title: '',
  description: '',
  event_date: '',
  start_time: '',
  end_time: '',
  venue_name: '',
  address: '',
  maps_url: '',
  dress_code: '',
  programme: [],
  rsvp_enabled: true,
  capacity: '',
  max_party_size: 4,
  is_published: true,
  sort_order: 0,
}

const nullIfEmpty = (v) => (typeof v === 'string' && v.trim() === '' ? null : typeof v === 'string' ? v.trim() : v)

function toPayload(e) {
  return {
    ...e,
    title: e.title.trim(),
    description: nullIfEmpty(e.description),
    event_date: nullIfEmpty(e.event_date),
    start_time: nullIfEmpty(e.start_time),
    end_time: nullIfEmpty(e.end_time),
    venue_name: nullIfEmpty(e.venue_name),
    address: nullIfEmpty(e.address),
    maps_url: nullIfEmpty(e.maps_url),
    dress_code: nullIfEmpty(e.dress_code),
    capacity: e.capacity === '' || e.capacity === null ? null : Number(e.capacity),
    max_party_size: Number(e.max_party_size),
    sort_order: Number(e.sort_order) || 0,
    programme: (e.programme ?? []).filter((p) => p.title?.trim()).map((p) => ({ time: p.time || '', endTime: p.endTime || '', title: p.title.trim() })),
  }
}

export function EventsAdmin() {
  const { content, refresh } = useSite()
  const events = useAsync(listEvents, [])
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const { busy, run, feedback } = useAction()

  const save = async (e) => {
    e.preventDefault()
    if (editing.maps_url && !/^https:\/\//i.test(editing.maps_url.trim())) {
      return run(() => Promise.reject(new Error('The map link must start with https://')))
    }
    const res = await run(() => saveEvent(toPayload(editing)), 'Event saved.')
    if (res) {
      setEditing(null)
      events.reload()
      refresh()
    }
  }

  const set = (key) => (e) => setEditing((ev) => ({ ...ev, [key]: e.target.value }))

  return (
    <>
      <AdminHeader title="Events" description="Akad nikah, bersanding, reception — add each celebration guests can RSVP to.">
        <button type="button" className="btn-primary btn-sm" onClick={() => setEditing({ ...EMPTY, sort_order: (events.data?.length ?? 0) * 10 })}>
          <Plus className="size-4" /> Add event
        </button>
      </AdminHeader>
      {feedback}

      {events.loading ? (
        <LoadingBlock />
      ) : events.error ? (
        <Notice tone="error">{friendlyError(events.error)}</Notice>
      ) : events.data.length === 0 ? (
        <EmptyState title="No events yet">Add your first celebration so guests can see the details and RSVP.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {events.data.map((ev) => (
            <li key={ev.id} className="rounded-2xl border border-champagne bg-white/70 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-2xl">{ev.title}</p>
                  <p className="text-xs text-muted">
                    {[ev.event_date && formatDate(ev.event_date, content.locale), formatTimeRange(ev.start_time, ev.end_time, content.locale)].filter(Boolean).join(' · ') ||
                      'No date set'}
                  </p>
                  {ev.venue_name && <p className="text-xs text-muted">{ev.venue_name}</p>}
                </div>
                <div className="flex gap-1">
                  <button type="button" className="btn-ghost btn-sm px-3" onClick={() => setEditing({ ...EMPTY, ...ev, capacity: ev.capacity ?? '', start_time: ev.start_time?.slice(0, 5) ?? '', end_time: ev.end_time?.slice(0, 5) ?? '' })} aria-label={`Edit ${ev.title}`}>
                    <Pencil className="size-4" />
                  </button>
                  <button type="button" className="btn-ghost btn-sm px-3 text-rose" onClick={() => setDeleting(ev)} aria-label={`Delete ${ev.title}`}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[0.6rem] tracking-wider uppercase">
                <span className={`rounded-full px-2 py-0.5 ${ev.is_published ? 'bg-sage-soft text-sage-deep' : 'bg-cream text-muted'}`}>{ev.is_published ? 'Published' : 'Hidden'}</span>
                <span className={`rounded-full px-2 py-0.5 ${ev.rsvp_enabled ? 'bg-champagne text-gold-deep' : 'bg-cream text-muted'}`}>{ev.rsvp_enabled ? 'RSVP on' : 'RSVP off'}</span>
                <span className="rounded-full bg-cream px-2 py-0.5 text-muted">Max {ev.max_party_size} / party</span>
                {ev.capacity && <span className="rounded-full bg-cream px-2 py-0.5 text-muted">Capacity {ev.capacity}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit event' : 'New event'} wide>
        {editing && (
          <form onSubmit={save} className="space-y-4">
            {feedback}
            <label className="block">
              <span className="field-label">Title</span>
              <input className="field-input" required maxLength={100} value={editing.title} onChange={set('title')} placeholder="e.g. Akad Nikah" />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="field-label">Date</span>
                <input type="date" className="field-input" value={editing.event_date ?? ''} onChange={set('event_date')} />
              </label>
              <label className="block">
                <span className="field-label">Start time</span>
                <input type="time" className="field-input" value={editing.start_time ?? ''} onChange={set('start_time')} />
              </label>
              <label className="block">
                <span className="field-label">End time</span>
                <input type="time" className="field-input" value={editing.end_time ?? ''} onChange={set('end_time')} />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Venue</span>
                <input className="field-input" maxLength={150} value={editing.venue_name ?? ''} onChange={set('venue_name')} />
              </label>
              <label className="block">
                <span className="field-label">Dress code</span>
                <input className="field-input" maxLength={300} value={editing.dress_code ?? ''} onChange={set('dress_code')} />
              </label>
            </div>
            <label className="block">
              <span className="field-label">Address</span>
              <textarea rows={2} className="field-input" maxLength={300} value={editing.address ?? ''} onChange={set('address')} />
            </label>
            <label className="block">
              <span className="field-label">Google Maps link (optional)</span>
              <input type="url" className="field-input" maxLength={600} value={editing.maps_url ?? ''} onChange={set('maps_url')} placeholder="https://maps.app.goo.gl/…" />
              <span className="field-hint">If empty, directions are generated from the venue and address.</span>
            </label>
            <label className="block">
              <span className="field-label">Description</span>
              <textarea rows={3} className="field-input" maxLength={2000} value={editing.description ?? ''} onChange={set('description')} />
            </label>

            <div>
              <span className="field-label">Programme</span>
              <ListEditor
                items={editing.programme}
                onChange={(programme) => setEditing((ev) => ({ ...ev, programme }))}
                fields={[
                  { key: 'time', label: 'Time (optional)', type: 'time' },
                  { key: 'endTime', label: 'Until (optional)', type: 'time' },
                  { key: 'title', label: 'Item', placeholder: 'e.g. Menerima Jemputan', wide: true },
                ]}
                emptyItem={{ time: '', endTime: '', title: '' }}
                addLabel="Add programme item"
                max={30}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="field-label">Max guests per reply</span>
                <input type="number" min={1} max={20} required className="field-input" value={editing.max_party_size} onChange={set('max_party_size')} />
              </label>
              <label className="block">
                <span className="field-label">Capacity (optional)</span>
                <input type="number" min={1} className="field-input" value={editing.capacity ?? ''} onChange={set('capacity')} placeholder="Unlimited" />
              </label>
              <label className="block">
                <span className="field-label">Display order</span>
                <input type="number" className="field-input" value={editing.sort_order} onChange={set('sort_order')} />
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle label="Published" description="Visible on the website" checked={editing.is_published} onChange={(v) => setEditing((ev) => ({ ...ev, is_published: v }))} />
              <Toggle label="Accept RSVPs" checked={editing.rsvp_enabled} onChange={(v) => setEditing((ev) => ({ ...ev, rsvp_enabled: v }))} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Saving…' : 'Save event'}
            </button>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete event?"
        message={`“${deleting?.title}” and all RSVPs for it will be permanently deleted.`}
        busy={busy}
        onConfirm={async () => {
          await run(() => deleteEvent(deleting.id), 'Event deleted.')
          setDeleting(null)
          events.reload()
          refresh()
        }}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}
