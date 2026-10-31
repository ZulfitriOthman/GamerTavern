import { Check, EyeOff, Film, FolderCog, ImagePlus, LoaderCircle, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { EmptyState, LoadingBlock, Notice } from '../../components/ui/Feedback.jsx'
import { ConfirmDialog, Modal } from '../../components/ui/Modal.jsx'
import { useSite } from '../../context/SiteContext.jsx'
import { friendlyError } from '../../lib/errors.js'
import { prepareMedia } from '../../lib/mediaUpload.js'
import { useAsync } from '../../hooks/useAsync.js'
import { checkMediaFile, MEDIA_ACCEPT } from '../../lib/validation.js'
import { deleteAlbum, deletePhoto, listAlbums, listPhotos, saveAlbum, updatePhoto, uploadOfficialMedia } from '../../services/adminService.js'
import { AdminHeader } from '../components/AdminLayout.jsx'
import { Tabs, Toggle, useAction } from '../components/shared.jsx'

const STATUS_STYLE = { pending: 'bg-champagne text-gold-deep', approved: 'bg-sage-soft text-sage-deep', rejected: 'bg-rose/10 text-rose' }
// Guest uploads are published automatically; 'pending' only exists for items from the old approval workflow.
const STATUS_LABEL = { pending: 'pending (old)', approved: 'published', rejected: 'hidden' }

export function PhotosAdmin() {
  const { refresh } = useSite()
  const [status, setStatus] = useState('all')
  const photos = useAsync(() => listPhotos(status), [status])
  const albums = useAsync(listAlbums, [])
  const [albumFilter, setAlbumFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [albumsOpen, setAlbumsOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const { busy, run, feedback } = useAction()

  const albumName = (id) => albums.data?.find((a) => a.id === id)?.title ?? 'No album'
  const rows = useMemo(() => (photos.data ?? []).filter((p) => albumFilter === 'all' || p.album_id === albumFilter), [photos.data, albumFilter])

  const setPhotoStatus = async (p, next) => {
    await run(() => updatePhoto(p.id, { status: next }), next === 'approved' ? 'Photo approved.' : 'Photo rejected.')
    photos.reload()
  }

  return (
    <>
      <AdminHeader title="Photos & Videos" description="Guest uploads appear in the gallery immediately. Hide or delete anything inappropriate here.">
        <button type="button" className="btn-outline btn-sm" onClick={() => setAlbumsOpen(true)}>
          <FolderCog className="size-4" /> Albums
        </button>
        <button type="button" className="btn-primary btn-sm" onClick={() => setUploadOpen(true)}>
          <ImagePlus className="size-4" /> Upload photos
        </button>
      </AdminHeader>
      {feedback}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Tabs
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All' },
            { value: 'approved', label: 'Published' },
            { value: 'rejected', label: 'Hidden' },
            { value: 'pending', label: 'Pending (old)' },
          ]}
        />
        <select className="field-input mb-5 sm:w-56" value={albumFilter} onChange={(e) => setAlbumFilter(e.target.value)} aria-label="Filter by album">
          <option value="all">All albums</option>
          {(albums.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      </div>

      {photos.loading ? (
        <LoadingBlock />
      ) : photos.error ? (
        <Notice tone="error">{friendlyError(photos.error)}</Notice>
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing here">
          {status === 'all' ? 'Shared photos, GIFs and videos will appear here.' : 'Try another filter.'}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {rows.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-2xl border border-champagne bg-white/70">
              <a href={p.url} target="_blank" rel="noreferrer" className="block aspect-square bg-cream">
                {p.media_type === 'video' && !p.posterUrl ? (
                  <video src={`${p.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" aria-label={p.caption ?? 'Video'} />
                ) : (
                  (p.posterUrl || p.thumbUrl) && <img src={p.posterUrl || p.thumbUrl} alt={p.caption ?? ''} loading="lazy" className="h-full w-full object-cover" />
                )}
              </a>
              <div className="space-y-1.5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[0.6rem] tracking-wider uppercase ${STATUS_STYLE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                    {p.media_type === 'video' && <Film className="size-3.5 text-muted" aria-label="Video" />}
                    {p.media_type === 'gif' && <span className="text-[0.6rem] font-medium text-muted">GIF</span>}
                  </span>
                  <span className="truncate text-[0.65rem] text-muted">{albumName(p.album_id)}</span>
                </div>
                <p className="truncate text-xs text-ink" title={p.caption ?? ''}>
                  {p.caption || <span className="text-muted italic">No caption</span>}
                </p>
                <p className="truncate text-[0.65rem] text-muted">{p.source === 'guest' ? `By ${p.uploader_name}` : 'Official'}</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {p.status !== 'approved' && (
                    <button type="button" className="btn btn-sm min-h-8 flex-1 bg-sage-deep px-2 text-white" onClick={() => setPhotoStatus(p, 'approved')} disabled={busy}>
                      <Check className="size-3.5" /> Publish
                    </button>
                  )}
                  {p.status !== 'rejected' && (
                    <button type="button" className="btn-outline btn-sm min-h-8 flex-1 px-2" onClick={() => setPhotoStatus(p, 'rejected')} disabled={busy}>
                      <EyeOff className="size-3.5" /> Hide
                    </button>
                  )}
                  <button type="button" className="btn-ghost btn-sm min-h-8 px-2" onClick={() => setEditing({ ...p, caption: p.caption ?? '' })} aria-label="Edit photo">
                    <Pencil className="size-3.5" />
                  </button>
                  <button type="button" className="btn-ghost btn-sm min-h-8 px-2 text-rose" onClick={() => setDeleting(p)} aria-label="Delete photo">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit photo">
        {editing && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              await run(
                () => updatePhoto(editing.id, { caption: editing.caption.trim() || null, album_id: editing.album_id || null, sort_order: Number(editing.sort_order) || 0 }),
                'Photo updated.',
              )
              setEditing(null)
              photos.reload()
            }}
          >
            {editing.media_type === 'video' ? (
              <video src={editing.url} poster={editing.posterUrl || undefined} controls playsInline preload="metadata" className="max-h-56 w-full rounded-2xl bg-black" />
            ) : (
              <img src={editing.thumbUrl} alt="" className="max-h-56 w-full rounded-2xl object-contain" />
            )}
            <label className="block">
              <span className="field-label">Caption</span>
              <input className="field-input" maxLength={300} value={editing.caption} onChange={(e) => setEditing({ ...editing, caption: e.target.value })} />
            </label>
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <label className="block">
                <span className="field-label">Album</span>
                <select className="field-input" value={editing.album_id ?? ''} onChange={(e) => setEditing({ ...editing, album_id: e.target.value })}>
                  <option value="">No album</option>
                  {(albums.data ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="field-label">Order</span>
                <input type="number" className="field-input" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })} />
              </label>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              Save
            </button>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete photo?"
        message="The photo file and its details will be permanently deleted. This cannot be undone."
        busy={busy}
        onConfirm={async () => {
          await run(() => deletePhoto(deleting), 'Photo deleted.')
          setDeleting(null)
          photos.reload()
        }}
        onCancel={() => setDeleting(null)}
      />

      <AlbumsModal
        open={albumsOpen}
        onClose={() => setAlbumsOpen(false)}
        albums={albums.data ?? []}
        onChanged={() => {
          albums.reload()
          refresh()
        }}
      />
      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        albums={albums.data ?? []}
        onDone={() => {
          setStatus('approved')
          photos.reload()
        }}
      />
    </>
  )
}

function AlbumsModal({ open, onClose, albums, onChanged }) {
  const { busy, run, feedback } = useAction()
  const [draft, setDraft] = useState({ title: '', slug: '' })
  const [deleting, setDeleting] = useState(null)

  const slugify = (s) =>
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)

  const update = async (album, patch) => {
    // The server moves the guest-upload flag atomically (only one album may have it).
    await run(() => saveAlbum({ ...album, ...patch }), 'Album updated.')
    onChanged()
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Albums" wide>
        {feedback}
        <ul className="space-y-3">
          {albums.map((a) => (
            <li key={a.id} className="rounded-2xl border border-champagne bg-white/60 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_6rem_auto] sm:items-end">
                <label>
                  <span className="field-label">Title</span>
                  <input className="field-input" defaultValue={a.title} maxLength={80} onBlur={(e) => e.target.value.trim() && e.target.value !== a.title && update(a, { title: e.target.value.trim() })} />
                </label>
                <label>
                  <span className="field-label">Order</span>
                  <input type="number" className="field-input" defaultValue={a.sort_order} onBlur={(e) => Number(e.target.value) !== a.sort_order && update(a, { sort_order: Number(e.target.value) || 0 })} />
                </label>
                <button type="button" className="btn-ghost btn-sm text-rose" onClick={() => setDeleting(a)} disabled={busy}>
                  <Trash2 className="size-4" /> Delete
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Toggle label="Visible to guests" checked={a.is_public} onChange={(v) => update(a, { is_public: v })} />
                <Toggle label="Receives guest uploads" checked={a.is_guest_uploads} onChange={(v) => update(a, { is_guest_uploads: v })} description="Only one album can" />
              </div>
            </li>
          ))}
        </ul>
        <form
          className="mt-6 grid gap-3 rounded-2xl border border-dashed border-sand p-4 sm:grid-cols-[1fr_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault()
            const slug = slugify(draft.title)
            if (!slug) return
            await run(() => saveAlbum({ title: draft.title.trim(), slug, sort_order: (albums.at(-1)?.sort_order ?? 0) + 10 }), 'Album created.')
            setDraft({ title: '', slug: '' })
            onChanged()
          }}
        >
          <label>
            <span className="field-label">New album</span>
            <input className="field-input" placeholder="e.g. Reception" maxLength={80} value={draft.title} onChange={(e) => setDraft({ title: e.target.value })} />
          </label>
          <button type="submit" className="btn-primary btn-sm" disabled={busy || !draft.title.trim()}>
            Add album
          </button>
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete album?"
        message={`Photos in “${deleting?.title}” are kept but will no longer belong to an album.`}
        busy={busy}
        onConfirm={async () => {
          await run(() => deleteAlbum(deleting.id), 'Album deleted.')
          setDeleting(null)
          onChanged()
        }}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

function UploadModal({ open, onClose, albums, onDone }) {
  const inputRef = useRef(null)
  const [albumId, setAlbumId] = useState('')
  const [progress, setProgress] = useState(null) // { done, total, failed: [] }

  const upload = async (files) => {
    const list = [...files]
    if (!list.length) return
    const failed = []
    setProgress({ done: 0, total: list.length, failed })
    for (const file of list) {
      try {
        const problem = checkMediaFile(file)
        if (problem) throw new Error(problem)
        await uploadOfficialMedia(await prepareMedia(file), { albumId })
      } catch (err) {
        failed.push(`${file.name}: ${friendlyError(err, err.message)}`)
      }
      setProgress((p) => ({ ...p, done: p.done + 1, failed: [...failed] }))
    }
    if (inputRef.current) inputRef.current.value = ''
    onDone()
  }

  const running = progress && progress.done < progress.total
  return (
    <Modal
      open={open}
      onClose={() => {
        if (running) return
        setProgress(null)
        onClose()
      }}
      title="Upload photos & videos"
    >
      <p className="text-sm text-muted">Photos, GIFs and videos you upload here are published immediately. Photos are resized and stripped of location metadata first.</p>
      <label className="mt-4 block">
        <span className="field-label">Album</span>
        <select className="field-input" value={albumId} onChange={(e) => setAlbumId(e.target.value)} disabled={running}>
          <option value="">No album</option>
          {albums.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="btn-primary mt-5 w-full" onClick={() => inputRef.current?.click()} disabled={running}>
        {running ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        {running ? `Uploading ${progress.done + 1} of ${progress.total}…` : 'Choose photos, GIFs or videos'}
      </button>
      <input ref={inputRef} type="file" accept={MEDIA_ACCEPT} multiple className="sr-only" tabIndex={-1} onChange={(e) => upload(e.target.files)} />
      {progress && !running && (
        <Notice tone={progress.failed.length ? 'warning' : 'success'} className="mt-4">
          {progress.total - progress.failed.length} of {progress.total} uploaded.
          {progress.failed.length > 0 && <span className="mt-1 block text-xs">{progress.failed.join(' · ')}</span>}
        </Notice>
      )}
    </Modal>
  )
}
