import { CalendarHeart, CalendarPlus, MapPin, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Checkbox, Field } from '../../components/ui/Field.jsx'
import { EmptyState, LoadError } from '../../components/ui/Feedback.jsx'
import { ConfirmDialog, Modal } from '../../components/ui/Modal.jsx'
import { useSite } from '../../context/SiteContext.jsx'
import { formatDate, formatTimeRange, isoDate } from '../../lib/time.js'
import { deleteEvent, listEvents, saveEvent } from '../../services/adminService.js'
import { useAction, useAdminAsync } from '../auth.jsx'
import { ActionStatus, IconBtn, ListEditor, PageTitle, SkeletonRows, StatusPill } from '../components/shared.jsx'
import { hhmm } from '../lib.js'

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

/** API row → form values (dates YYYY-MM-DD, times HH:MM, nulls → ''). */
function toForm(e) {
  return {
    ...EMPTY,
    ...Object.fromEntries(Object.entries(e).map(([k, v]) => [k, v ?? ''])),
    event_date: isoDate(e.event_date) ?? '',
    start_time: hhmm(e.start_time),
    end_time: hhmm(e.end_time),
    programme: Array.isArray(e.programme) ? e.programme.map((p) => ({ time: hhmm(p.time), endTime: hhmm(p.endTime), title: p.title ?? '' })) : [],
    rsvp_enabled: Boolean(Number(e.rsvp_enabled)),
    is_published: Boolean(Number(e.is_published)),
  }
}

export default function EventsPage() {
  const { locale } = useSite()
  const { data, loading, error, reload, setData } = useAdminAsync(listEvents)
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const action = useAction()

  const remove = async () => {
    if (await action.run(() => deleteEvent(removing.id), 'Event deleted.')) {
      setData((list) => list.filter((e) => e.id !== removing.id))
      setRemoving(null)
    }
  }

  return (
    <>
      <PageTitle
        title="Events"
        description="Ceremonies shown on the website and offered in the RSVP form."
        actions={
          <button type="button" className="btn-primary" onClick={() => setEditing(EMPTY)}>
            <CalendarPlus className="size-4" aria-hidden="true" /> Add event
          </button>
        }
      />
      <ActionStatus error={!removing ? action.error : ''} notice={action.notice} />

      {error && <LoadError message={error} onRetry={reload} />}
      {loading && !data && <SkeletonRows />}
      {data &&
        (data.length === 0 ? (
          <EmptyState icon={CalendarHeart} title="No events yet">
            Add your Akad Nikah, Bersanding, reception or any other ceremony.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {data.map((e) => (
              <li key={e.id} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-serif text-2xl leading-tight">{e.title}</p>
                      {!Number(e.is_published) && <StatusPill status="hidden">Draft</StatusPill>}
                      {Number(e.rsvp_enabled) ? <StatusPill status="approved">RSVP on</StatusPill> : <StatusPill status="hidden">RSVP off</StatusPill>}
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {[formatDate(e.event_date, locale), formatTimeRange(e.start_time, e.end_time, locale)].filter(Boolean).join(' · ') || 'Date to be confirmed'}
                    </p>
                    {e.venue_name && (
                      <p className="mt-1 flex items-center gap-1.5 text-sm">
                        <MapPin className="size-3.5 text-gold" aria-hidden="true" /> {e.venue_name}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted/80">
                      Up to {e.max_party_size} per reply{e.capacity ? ` · capacity ${e.capacity}` : ''} · order {e.sort_order}
                    </p>
                  </div>
                  <div className="flex">
                    <IconBtn label="Edit event" icon={Pencil} onClick={() => setEditing(toForm(e))} />
                    <IconBtn label="Delete event" icon={Trash2} danger onClick={() => setRemoving(e)} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {editing && (
        <EventForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            action.setNotice('Event saved. Reload the public site to see the change.')
            reload()
          }}
        />
      )}
      <ConfirmDialog open={Boolean(removing)} title="Delete this event?" busy={action.busy} onConfirm={remove} onClose={() => setRemoving(null)}>
        {removing && (
          <>
            <strong className="text-ink">{removing.title}</strong> will be deleted, <strong className="text-rose">together with every RSVP for it</strong>. To keep the
            replies, unpublish the event instead.
            {action.error && <p className="mt-3 text-rose">{action.error}</p>}
          </>
        )}
      </ConfirmDialog>
    </>
  )
}

function EventForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial)
  const [mapError, setMapError] = useState('')
  const { busy, error, run } = useAction()
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    const maps = form.maps_url.trim()
    if (maps && !/^https:\/\//i.test(maps)) return setMapError('The map link must start with https://')
    setMapError('')
    const body = {
      ...form,
      title: form.title.trim(),
      description: form.description || null,
      event_date: form.event_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      venue_name: form.venue_name || null,
      address: form.address || null,
      maps_url: maps || null,
      dress_code: form.dress_code || null,
      programme: form.programme.filter((p) => p.title?.trim()),
      capacity: form.capacity === '' ? null : Number(form.capacity),
      max_party_size: Number(form.max_party_size),
      sort_order: Number(form.sort_order) || 0,
    }
    if (await run(() => saveEvent(initial.id ?? null, body))) onSaved()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? 'Edit event' : 'New event'}
      wide
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="event-form" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save event'}
          </button>
        </>
      }
    >
      <form id="event-form" onSubmit={save} className="space-y-4">
        <ActionStatus error={error} />
        <Field label="Title" value={form.title} onChange={set('title')} maxLength={100} required placeholder="e.g. Akad Nikah" />
        <Field label="Description" as="textarea" value={form.description} onChange={set('description')} maxLength={2000} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date" type="date" value={form.event_date} onChange={set('event_date')} />
          <Field label="Starts" type="time" value={form.start_time} onChange={set('start_time')} />
          <Field label="Ends" type="time" value={form.end_time} onChange={set('end_time')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Venue" value={form.venue_name} onChange={set('venue_name')} maxLength={150} />
          <Field label="Address" value={form.address} onChange={set('address')} maxLength={300} />
        </div>
        <Field
          label="Google Maps link"
          type="url"
          value={form.maps_url}
          onChange={set('maps_url')}
          maxLength={600}
          error={mapError}
          hint="Optional. Without it, guests get a map search for the venue and address."
          placeholder="https://maps.app.goo.gl/…"
        />
        <Field label="Dress code" value={form.dress_code} onChange={set('dress_code')} maxLength={300} />
        <div>
          <span className="field-label">Programme</span>
          <ListEditor
            items={form.programme}
            onChange={(programme) => setForm((f) => ({ ...f, programme }))}
            fields={[
              { key: 'time', label: 'From', type: 'time' },
              { key: 'endTime', label: 'Until', type: 'time' },
              { key: 'title', label: 'Item', wide: true },
            ]}
            emptyItem={{ time: '', endTime: '', title: '' }}
            addLabel="Add programme item"
            max={40}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Max guests per reply" type="number" min={1} max={20} value={form.max_party_size} onChange={set('max_party_size')} required />
          <Field label="Capacity" type="number" min={1} value={form.capacity} onChange={set('capacity')} hint="Blank = no limit" />
          <Field label="Display order" type="number" value={form.sort_order} onChange={set('sort_order')} />
        </div>
        <Checkbox label="Published" description="Shown on the website." checked={form.is_published} onChange={set('is_published')} />
        <Checkbox label="Accept RSVPs" description="Offered in the RSVP form while RSVPs are open." checked={form.rsvp_enabled} onChange={set('rsvp_enabled')} />
      </form>
    </Modal>
  )
}
