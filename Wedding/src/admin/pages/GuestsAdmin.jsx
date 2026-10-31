import { Check, Copy, Download, Link2, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState, LoadingBlock, Notice } from '../../components/ui/Feedback.jsx'
import { ConfirmDialog, Modal } from '../../components/ui/Modal.jsx'
import { downloadText, toCsv } from '../../lib/csv.js'
import { friendlyError } from '../../lib/errors.js'
import { siteUrl } from '../../lib/siteUrl.js'
import { useAsync } from '../../hooks/useAsync.js'
import { EMAIL_RE } from '../../lib/validation.js'
import { createGuests, deleteGuest, listGuests, regenerateInviteLink, updateGuest } from '../../services/adminService.js'
import { AdminHeader } from '../components/AdminLayout.jsx'
import { useAction } from '../components/shared.jsx'

const EMPTY = { name: '', email: '', phone: '', max_party_size: 2, notes: '' }
const inviteLink = (token) => `${siteUrl()}/rsvp/${token}`

/** Parses "Name, email, phone, seats" lines for bulk import. */
function parseBulk(text) {
  const rows = []
  const problems = []
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const [name, email, phone, seats] = line.split(',').map((s) => s?.trim())
      const max = seats ? Number(seats) : 2
      if (!name || name.length > 120) problems.push(`Line ${i + 1}: missing name`)
      else if (email && !EMAIL_RE.test(email)) problems.push(`Line ${i + 1}: invalid email`)
      else if (!Number.isInteger(max) || max < 1 || max > 20) problems.push(`Line ${i + 1}: seats must be 1–20`)
      else rows.push({ name, email: email || null, phone: phone || null, max_party_size: max })
    })
  return { rows, problems }
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="btn-outline btn-sm shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          setCopied(false)
        }
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : label}
    </button>
  )
}

export function GuestsAdmin() {
  const guests = useAsync(listGuests, [])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [relinking, setRelinking] = useState(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [newLinks, setNewLinks] = useState(null) // [{ name, link }] — shown once
  const { busy, run, feedback } = useAction()

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (guests.data ?? []).filter((g) => !q || [g.name, g.email, g.phone, g.notes].some((v) => v?.toLowerCase().includes(q)))
  }, [guests.data, query])

  const showLinks = (created) => setNewLinks(created.map((c) => ({ name: c.name, link: inviteLink(c.token) })))

  const save = async (e) => {
    e.preventDefault()
    const payload = {
      ...editing,
      name: editing.name.trim(),
      email: editing.email?.trim() || null,
      phone: editing.phone?.trim() || null,
      notes: editing.notes?.trim() || null,
      max_party_size: Number(editing.max_party_size),
    }
    const res = await run(() => (payload.id ? updateGuest(payload).then(() => []) : createGuests([payload])), 'Guest saved.')
    if (res) {
      setEditing(null)
      if (res.length) showLinks(res)
      guests.reload()
    }
  }

  const bulk = parseBulk(bulkText)
  const importBulk = async () => {
    const res = await run(() => createGuests(bulk.rows), `${bulk.rows.length} guests added.`)
    if (res) {
      setBulkOpen(false)
      setBulkText('')
      showLinks(res)
      guests.reload()
    }
  }

  const relink = async () => {
    const token = await run(() => regenerateInviteLink(relinking.id))
    if (token) {
      setNewLinks([{ name: relinking.name, link: inviteLink(token) }])
      guests.reload()
    }
    setRelinking(null)
  }

  return (
    <>
      <AdminHeader title="Invited Guests" description="Each entry is a household with its own seat limit and private RSVP link.">
        <button type="button" className="btn-outline btn-sm" onClick={() => setBulkOpen(true)}>
          <Upload className="size-4" /> Bulk add
        </button>
        <button type="button" className="btn-primary btn-sm" onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="size-4" /> Add guest
        </button>
      </AdminHeader>
      {feedback}

      <label className="relative mb-4 block">
        <span className="sr-only">Search guests</span>
        <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
        <input className="field-input pl-11" placeholder="Search guests…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      {guests.loading ? (
        <LoadingBlock />
      ) : guests.error ? (
        <Notice tone="error">{friendlyError(guests.error)}</Notice>
      ) : rows.length === 0 ? (
        <EmptyState title="No guests yet">
          Add guests to give them personal RSVP links. Guests can also RSVP without a link while RSVP mode is “open”.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {rows.map((g) => {
            const replies = g.rsvp_responses ?? []
            const attending = replies.filter((r) => r.attending).reduce((n, r) => Math.max(n, r.party_size), 0)
            return (
              <li key={g.id} className="flex flex-col gap-3 rounded-2xl border border-champagne bg-white/70 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">{g.name}</p>
                    <span className="rounded-full bg-cream px-2.5 py-0.5 text-[0.65rem] tracking-wider text-muted uppercase">{g.max_party_size} seats</span>
                    {replies.length === 0 ? (
                      <span className="text-[0.65rem] tracking-wider text-gold-deep uppercase">Awaiting reply</span>
                    ) : (
                      <span className="text-[0.65rem] tracking-wider text-sage-deep uppercase">
                        Replied{attending ? ` · up to ${attending} attending` : ' · declined'}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {[g.email, g.phone].filter(Boolean).join(' · ') || 'No contact details'}
                    {g.invite_created_at && ` · link issued ${new Date(g.invite_created_at).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex gap-1 self-end sm:self-center">
                  <button type="button" className="btn-outline btn-sm" onClick={() => setRelinking(g)}>
                    <Link2 className="size-4" /> {g.has_invite_link ? 'New link' : 'Create link'}
                  </button>
                  <button type="button" className="btn-ghost btn-sm px-3" onClick={() => setEditing({ ...g })} aria-label={`Edit ${g.name}`}>
                    <Pencil className="size-4" />
                  </button>
                  <button type="button" className="btn-ghost btn-sm px-3 text-rose" onClick={() => setDeleting(g)} aria-label={`Delete ${g.name}`}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit guest' : 'Add guest'}>
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <label className="block">
              <span className="field-label">Name / household</span>
              <input className="field-input" required maxLength={120} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Email</span>
                <input type="email" className="field-input" maxLength={254} value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </label>
              <label className="block">
                <span className="field-label">Phone</span>
                <input type="tel" className="field-input" maxLength={40} value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </label>
            </div>
            <label className="block">
              <span className="field-label">Seats reserved (guest limit)</span>
              <input type="number" min={1} max={20} required className="field-input" value={editing.max_party_size} onChange={(e) => setEditing({ ...editing, max_party_size: e.target.value })} />
            </label>
            <label className="block">
              <span className="field-label">Private notes</span>
              <textarea rows={2} maxLength={1000} className="field-input" value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </label>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Saving…' : editing.id ? 'Save guest' : 'Add guest & create link'}
            </button>
          </form>
        )}
      </Modal>

      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk add guests" wide>
        <p className="text-sm text-muted">
          One guest per line: <code>Name, email, phone, seats</code>. Only the name is required; seats default to 2. A private RSVP link is created for each.
        </p>
        <textarea rows={8} className="field-input mt-4 font-mono text-sm" value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={'Keluarga Contoh, , , 4\nAwang Contoh'} />
        {bulk.problems.length > 0 && (
          <Notice tone="warning" className="mt-3">
            {bulk.problems.slice(0, 5).join(' · ')}
          </Notice>
        )}
        <button type="button" className="btn-primary mt-4 w-full" disabled={busy || bulk.rows.length === 0 || bulk.problems.length > 0} onClick={importBulk}>
          Add {bulk.rows.length} guest{bulk.rows.length === 1 ? '' : 's'}
        </button>
      </Modal>

      <Modal open={Boolean(newLinks)} onClose={() => setNewLinks(null)} title="Private RSVP links" wide>
        <Notice tone="warning" title="Copy these now">
          For security only a fingerprint of each link is stored, so they cannot be shown again. You can always create a new link later (the old one then stops working).
        </Notice>
        <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
          {(newLinks ?? []).map((l) => (
            <li key={l.link} className="flex items-center gap-3 rounded-xl border border-champagne bg-white/70 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{l.name}</p>
                <p className="truncate font-mono text-xs text-muted">{l.link}</p>
              </div>
              <CopyButton text={l.link} />
            </li>
          ))}
        </ul>
        {newLinks?.length > 1 && (
          <button
            type="button"
            className="btn-outline btn-sm mt-4"
            onClick={() =>
              downloadText(
                `rsvp-links-${new Date().toISOString().slice(0, 10)}.csv`,
                toCsv(newLinks, [
                  { key: 'name', label: 'Guest' },
                  { key: 'link', label: 'RSVP link' },
                ]),
              )
            }
          >
            <Download className="size-4" /> Download all as CSV
          </button>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(relinking)}
        title={relinking?.has_invite_link ? 'Create a new link?' : 'Create RSVP link?'}
        message={
          relinking?.has_invite_link
            ? `${relinking?.name}'s current link will stop working immediately. Their existing replies are kept.`
            : `A private RSVP link will be created for ${relinking?.name}.`
        }
        confirmLabel="Create link"
        busy={busy}
        onConfirm={relink}
        onCancel={() => setRelinking(null)}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete guest?"
        message={`${deleting?.name}'s invite link will stop working. Any RSVPs they already sent are kept but unlinked.`}
        busy={busy}
        onConfirm={async () => {
          await run(() => deleteGuest(deleting.id), 'Guest deleted.')
          setDeleting(null)
          guests.reload()
        }}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}
