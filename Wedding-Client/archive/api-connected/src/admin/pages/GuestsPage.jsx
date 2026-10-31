import { KeyRound, Link2, Pencil, Search, Trash2, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Field } from '../../components/ui/Field.jsx'
import { EmptyState, LoadError, Notice } from '../../components/ui/Feedback.jsx'
import { ConfirmDialog, Modal } from '../../components/ui/Modal.jsx'
import { formatDateTime } from '../../lib/time.js'
import { createGuests, deleteGuest, listGuests, newInviteLink, updateGuest } from '../../services/adminService.js'
import { useAction, useAdminAsync } from '../auth.jsx'
import { ActionStatus, CopyButton, IconBtn, PageTitle, QrCode, SkeletonRows, StatusPill } from '../components/shared.jsx'
import { inviteLink, parseBulk } from '../lib.js'

const EMPTY = { name: '', email: '', phone: '', max_party_size: 2, notes: '' }

export default function GuestsPage() {
  const { data, loading, error, reload, setData } = useAdminAsync(listGuests)
  const guests = useMemo(() => data ?? [], [data])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null) // guest object, or EMPTY for new
  const [bulkOpen, setBulkOpen] = useState(false)
  const [relinking, setRelinking] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [links, setLinks] = useState(null) // [{ name, link }] shown once
  const action = useAction()

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? guests.filter((g) => [g.name, g.email, g.phone, g.notes].some((v) => v && v.toLowerCase().includes(q))) : guests
  }, [guests, query])

  const showLinks = (created) => setLinks(created.map((c) => ({ name: c.name, link: inviteLink(c.token) })))

  const relink = async () => {
    const token = await action.run(() => newInviteLink(relinking.id))
    if (typeof token === 'string') {
      showLinks([{ name: relinking.name, token }])
      setRelinking(null)
      reload()
    }
  }

  const remove = async () => {
    const ok = await action.run(() => deleteGuest(removing.id), 'Guest removed.')
    if (ok) {
      setData((list) => list.filter((g) => g.id !== removing.id))
      setRemoving(null)
    }
  }

  return (
    <>
      <PageTitle
        title="Guests"
        description="Invited households, their seat limits and private RSVP links."
        actions={
          <>
            <button type="button" className="btn-outline" onClick={() => setBulkOpen(true)}>
              <Users className="size-4" aria-hidden="true" /> Add many
            </button>
            <button type="button" className="btn-primary" onClick={() => setEditing(EMPTY)}>
              <UserPlus className="size-4" aria-hidden="true" /> Add guest
            </button>
          </>
        }
      />
      <ActionStatus error={!relinking && !removing ? action.error : ''} notice={action.notice} />

      <label className="relative mb-4 block">
        <span className="sr-only">Search guests</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input className="input !pl-10" placeholder="Search guests" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      {error && <LoadError message={error} onRetry={reload} />}
      {loading && !data && <SkeletonRows />}
      {data &&
        (shown.length === 0 ? (
          <EmptyState icon={Users} title={guests.length ? 'No guests match' : 'No invited guests yet'}>
            {guests.length ? 'Try a different search.' : 'Add guests to create private RSVP links with their own seat limits.'}
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {shown.map((g) => {
              const replies = g.rsvp_responses ?? []
              const yes = replies.filter((r) => Number(r.attending) === 1)
              return (
                <li key={g.id} className="card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{g.name}</p>
                        <span className="text-xs text-muted">· {g.max_party_size} seat{g.max_party_size === 1 ? '' : 's'}</span>
                        {replies.length === 0 ? (
                          <StatusPill status="pending">No reply</StatusPill>
                        ) : yes.length ? (
                          <StatusPill status="yes">Attending · {yes.reduce((n, r) => n + Number(r.party_size || 0), 0)}</StatusPill>
                        ) : (
                          <StatusPill status="no">Declined</StatusPill>
                        )}
                      </div>
                      {(g.email || g.phone) && <p className="mt-1 text-sm break-all text-muted">{[g.email, g.phone].filter(Boolean).join(' · ')}</p>}
                      {g.notes && <p className="mt-1 text-sm whitespace-pre-line text-muted">{g.notes}</p>}
                      <p className="mt-2 text-xs text-muted/80">
                        {g.has_invite_link ? `Link created ${formatDateTime(g.invite_created_at)}` : 'No active link'}
                      </p>
                    </div>
                    <div className="flex">
                      <IconBtn label="New invite link" icon={KeyRound} onClick={() => setRelinking(g)} />
                      <IconBtn label="Edit guest" icon={Pencil} onClick={() => setEditing(g)} />
                      <IconBtn label="Remove guest" icon={Trash2} danger onClick={() => setRemoving(g)} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        ))}

      {editing && (
        <GuestForm
          guest={editing}
          onClose={() => setEditing(null)}
          onSaved={(created) => {
            setEditing(null)
            if (created) showLinks(created)
            else action.setNotice('Guest updated.')
            reload()
          }}
        />
      )}
      {bulkOpen && (
        <BulkAdd
          onClose={() => setBulkOpen(false)}
          onSaved={(created) => {
            setBulkOpen(false)
            showLinks(created)
            reload()
          }}
        />
      )}
      {links && <LinksModal links={links} onClose={() => setLinks(null)} />}

      <ConfirmDialog open={Boolean(relinking)} title="Create a new link?" tone="primary" confirmLabel="Create new link" busy={action.busy} onConfirm={relink} onClose={() => setRelinking(null)}>
        {relinking && (
          <>
            A new private RSVP link will be created for <strong className="text-ink">{relinking.name}</strong>. Their previous link will stop working immediately. Their existing
            replies are kept.
            {action.error && <p className="mt-3 text-rose">{action.error}</p>}
          </>
        )}
      </ConfirmDialog>
      <ConfirmDialog open={Boolean(removing)} title="Remove this guest?" busy={action.busy} onConfirm={remove} onClose={() => setRemoving(null)}>
        {removing && (
          <>
            <strong className="text-ink">{removing.name}</strong> will be removed and their invite link will stop working. Replies they already sent are kept in RSVPs.
            {action.error && <p className="mt-3 text-rose">{action.error}</p>}
          </>
        )}
      </ConfirmDialog>
    </>
  )
}

function GuestForm({ guest, onClose, onSaved }) {
  const isNew = !guest.id
  const [form, setForm] = useState({ ...EMPTY, ...guest, email: guest.email ?? '', phone: guest.phone ?? '', notes: guest.notes ?? '' })
  const { busy, error, run } = useAction()
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const save = async (e) => {
    e.preventDefault()
    const body = {
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      max_party_size: Number(form.max_party_size),
      notes: form.notes || null,
    }
    const result = await run(() => (isNew ? createGuests([body]) : updateGuest(guest.id, body)))
    if (result) onSaved(isNew ? result : null)
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add guest' : 'Edit guest'}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="guest-form" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : isNew ? 'Add & create link' : 'Save'}
          </button>
        </>
      }
    >
      <form id="guest-form" onSubmit={save} className="space-y-4">
        <ActionStatus error={error} />
        <Field label="Name or household" value={form.name} onChange={set('name')} maxLength={120} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" type="email" value={form.email} onChange={set('email')} maxLength={254} />
          <Field label="Phone" type="tel" value={form.phone} onChange={set('phone')} maxLength={40} />
        </div>
        <Field label="Seats (max guests per reply)" type="number" min={1} max={20} value={form.max_party_size} onChange={set('max_party_size')} required />
        <Field label="Private notes" as="textarea" value={form.notes} onChange={set('notes')} maxLength={1000} hint="Only visible in the dashboard." />
      </form>
    </Modal>
  )
}

function BulkAdd({ onClose, onSaved }) {
  const [text, setText] = useState('')
  const [seats, setSeats] = useState(2)
  const { busy, error, run } = useAction()
  const parsed = parseBulk(text, Number(seats) || 2)
  const save = async () => {
    const created = await run(() => createGuests(parsed))
    if (Array.isArray(created)) onSaved(created)
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Add many guests"
      wide
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={busy || !parsed.length || parsed.length > 500} onClick={save}>
            {busy ? 'Adding…' : `Add ${parsed.length} guest${parsed.length === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <ActionStatus error={error} />
        <Field
          label="One guest per line"
          as="textarea"
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Family Ahmad, 4\nSiti Aminah, 2\nJohn & Jane Smith'}
          hint="Optionally add “, seats” after a name."
        />
        <Field label="Default seats" type="number" min={1} max={20} value={seats} onChange={(e) => setSeats(e.target.value)} className="sm:w-48" />
        {parsed.length > 500 && <Notice tone="error">Please add at most 500 guests at a time.</Notice>}
      </div>
    </Modal>
  )
}

function LinksModal({ links, onClose }) {
  const all = links.map((l) => `${l.name}: ${l.link}`).join('\n')
  return (
    <Modal open onClose={onClose} title="Private RSVP links" wide footer={<button type="button" className="btn-primary" onClick={onClose}>I’ve saved the links</button>}>
      <Notice tone="info" title="Copy these links now" className="mb-4">
        For your guests’ privacy only a fingerprint of each link is stored, so they can’t be shown again. If one is lost, create a new link for that guest.
      </Notice>
      {links.length > 1 && (
        <div className="mb-4">
          <CopyButton text={all} label="Copy all links" />
        </div>
      )}
      <ul className="space-y-3">
        {links.map((l) => (
          <li key={l.link} className="flex flex-col gap-3 rounded-2xl border border-champagne bg-white/60 p-3 sm:flex-row sm:items-center">
            {links.length <= 5 && <QrCode value={l.link} size={96} />}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{l.name}</p>
              <p className="mt-0.5 flex items-start gap-1.5 text-xs break-all text-muted">
                <Link2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {l.link}
              </p>
            </div>
            <CopyButton text={l.link} />
          </li>
        ))}
      </ul>
    </Modal>
  )
}

