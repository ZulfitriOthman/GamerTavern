import { Eye, EyeOff, FolderPlus, Images, Pencil, Play, Trash2, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Checkbox, Field } from '../../components/ui/Field.jsx'
import { EmptyState, LoadError, ProgressBar } from '../../components/ui/Feedback.jsx'
import { ConfirmDialog, Modal } from '../../components/ui/Modal.jsx'
import { errorMessage, mediaUrl } from '../../lib/api.js'
import { formatDateTime } from '../../lib/time.js'
import { checkMediaFile, MEDIA_ACCEPT } from '../../lib/validation.js'
import { deleteAlbum, deletePhoto, listAlbums, listPhotos, saveAlbum, updatePhoto, uploadOfficialPhoto } from '../../services/adminService.js'
import { useAction, useAdminAsync, useAuth } from '../auth.jsx'
import { ActionStatus, IconBtn, PageTitle, SkeletonRows, StatusPill, Tabs } from '../components/shared.jsx'
import { slugify } from '../lib.js'

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'approved', label: 'Visible' },
  { value: 'rejected', label: 'Hidden' },
  { value: 'pending', label: 'Pending' },
]

export default function PhotosPage() {
  const [filter, setFilter] = useState('')
  const photos = useAdminAsync(() => listPhotos(filter), [filter])
  const albums = useAdminAsync(listAlbums)
  const albumList = useMemo(() => albums.data ?? [], [albums.data])
  const albumTitle = useMemo(() => new Map(albumList.map((a) => [a.id, a.title])), [albumList])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [albumsOpen, setAlbumsOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const action = useAction()

  const setStatus = async (photo, status) => {
    const ok = await action.run(() => updatePhoto(photo.id, { status }), status === 'approved' ? 'Photo is now visible.' : 'Photo hidden from guests.')
    if (ok) photos.setData((list) => (filter && filter !== status ? list.filter((p) => p.id !== photo.id) : list.map((p) => (p.id === photo.id ? { ...p, status } : p))))
  }

  const remove = async () => {
    const ok = await action.run(() => deletePhoto(removing.id), 'Deleted.')
    if (ok) {
      photos.setData((list) => list.filter((p) => p.id !== removing.id))
      setRemoving(null)
    }
  }

  return (
    <>
      <PageTitle
        title="Photos"
        description="Official photos and guest memories. Hidden items are only visible to you."
        actions={
          <>
            <button type="button" className="btn-outline" onClick={() => setAlbumsOpen(true)}>
              <FolderPlus className="size-4" aria-hidden="true" /> Albums
            </button>
            <button type="button" className="btn-primary" onClick={() => setUploadOpen(true)}>
              <Upload className="size-4" aria-hidden="true" /> Upload
            </button>
          </>
        }
      />
      <ActionStatus error={!removing ? action.error : ''} notice={action.notice} />
      <Tabs tabs={FILTERS} value={filter} onChange={setFilter} label="Filter photos" />

      {photos.error && <LoadError message={photos.error} onRetry={photos.reload} />}
      {photos.loading && !photos.data && <SkeletonRows />}
      {photos.data &&
        (photos.data.length === 0 ? (
          <EmptyState icon={Images} title="Nothing here yet">
            {filter ? 'No photos with this status.' : 'Upload official photos, or share the QR code so guests can add theirs.'}
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
            {photos.data.map((p) => (
              <li key={p.id} className={`card overflow-hidden ${p.status === 'rejected' ? 'opacity-70' : ''}`}>
                <a href={mediaUrl(p.url)} target="_blank" rel="noopener" className="relative block aspect-square bg-linen">
                  <Thumb photo={p} />
                  {p.media_type === 'video' && (
                    <span className="absolute top-2 right-2 rounded-full bg-ink/70 p-1.5 text-white">
                      <Play className="size-3.5" aria-hidden="true" />
                    </span>
                  )}
                </a>
                <div className="space-y-1.5 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusPill status={p.status} />
                    <span className="text-xs text-muted">{p.source === 'guest' ? 'Guest' : 'Official'}</span>
                  </div>
                  <p className="truncate text-xs text-muted">
                    {albumTitle.get(p.album_id) ?? 'No album'}
                    {p.uploader_name && ` · ${p.uploader_name}`}
                  </p>
                  {p.caption && <p className="line-clamp-2 text-sm">{p.caption}</p>}
                  <p className="text-[0.7rem] text-muted/80">{formatDateTime(p.created_at)}</p>
                  <div className="-mx-1 flex">
                    {p.status === 'approved' ? (
                      <IconBtn label="Hide from guests" icon={EyeOff} onClick={() => setStatus(p, 'rejected')} />
                    ) : (
                      <IconBtn label="Approve and show" icon={Eye} onClick={() => setStatus(p, 'approved')} />
                    )}
                    <IconBtn label="Edit caption and album" icon={Pencil} onClick={() => setEditing(p)} />
                    <IconBtn label="Delete" icon={Trash2} danger onClick={() => setRemoving(p)} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {uploadOpen && <UploadModal albums={albumList} onClose={() => setUploadOpen(false)} onDone={photos.reload} />}
      {albumsOpen && (
        <AlbumsModal
          albums={albumList}
          onClose={() => setAlbumsOpen(false)}
          onChanged={() => {
            albums.reload()
            photos.reload()
          }}
        />
      )}
      {editing && (
        <EditPhoto
          photo={editing}
          albums={albumList}
          onClose={() => setEditing(null)}
          onSaved={(patch) => {
            photos.setData((list) => list.map((p) => (p.id === editing.id ? { ...p, ...patch } : p)))
            setEditing(null)
          }}
        />
      )}
      <ConfirmDialog open={Boolean(removing)} title="Delete permanently?" busy={action.busy} onConfirm={remove} onClose={() => setRemoving(null)}>
        This file will be deleted from storage and can’t be recovered. To keep it but stop showing it, hide it instead.
        {action.error && <p className="mt-3 text-rose">{action.error}</p>}
      </ConfirmDialog>
    </>
  )
}

function Thumb({ photo }) {
  const src = mediaUrl(photo.thumbUrl || photo.posterUrl)
  if (src) return <img src={src} alt={photo.caption || ''} loading="lazy" className="size-full object-cover" />
  if (photo.media_type === 'video') return <video src={`${mediaUrl(photo.url)}#t=0.5`} preload="metadata" muted playsInline className="size-full object-cover" />
  return null
}

function EditPhoto({ photo, albums, onClose, onSaved }) {
  const [caption, setCaption] = useState(photo.caption ?? '')
  const [albumId, setAlbumId] = useState(photo.album_id ?? '')
  const { busy, error, run } = useAction()
  const save = async (e) => {
    e.preventDefault()
    const patch = { caption: caption.trim() || null, album_id: albumId || null }
    if (await run(() => updatePhoto(photo.id, patch))) onSaved(patch)
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Edit photo"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="edit-photo" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="edit-photo" onSubmit={save} className="space-y-4">
        <ActionStatus error={error} />
        <Field label="Caption" as="textarea" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} counter />
        <AlbumSelect albums={albums} value={albumId} onChange={setAlbumId} />
      </form>
    </Modal>
  )
}

function AlbumSelect({ albums, value, onChange }) {
  return (
    <Field label="Album" as="select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">No album</option>
      {albums.map((a) => (
        <option key={a.id} value={a.id}>
          {a.title}
          {Number(a.is_public) ? '' : ' (private)'}
        </option>
      ))}
    </Field>
  )
}

/** Sequential multi-file upload with per-file progress. */
function UploadModal({ albums, onClose, onDone }) {
  const { guard } = useAuth()
  const input = useRef(null)
  const [albumId, setAlbumId] = useState(albums.find((a) => !Number(a.is_guest_uploads))?.id ?? '')
  const [caption, setCaption] = useState('')
  const [items, setItems] = useState([]) // { file, status: 'ready'|'uploading'|'done'|'error', progress, error }
  const [running, setRunning] = useState(false)

  const pick = (files) => {
    const next = [...files].map((file) => {
      const problem = checkMediaFile(file)
      return { file, status: problem ? 'error' : 'ready', progress: 0, error: problem }
    })
    setItems((list) => [...list.filter((i) => i.status !== 'done'), ...next])
  }

  const patch = (file, values) => setItems((list) => list.map((i) => (i.file === file ? { ...i, ...values } : i)))

  const start = async () => {
    setRunning(true)
    for (const item of items.filter((i) => i.status === 'ready')) {
      patch(item.file, { status: 'uploading', progress: 0 })
      try {
        await guard(() => uploadOfficialPhoto(item.file, { albumId: albumId || undefined, caption: caption.trim() || undefined }, (p) => patch(item.file, { progress: p })))
        patch(item.file, { status: 'done', progress: 1 })
      } catch (e) {
        patch(item.file, { status: 'error', error: errorMessage(e, 'Upload failed.') })
      }
    }
    setRunning(false)
    onDone()
  }

  const ready = items.filter((i) => i.status === 'ready').length
  const done = items.filter((i) => i.status === 'done').length

  return (
    <Modal
      open
      onClose={running ? () => {} : onClose}
      title="Upload photos"
      wide
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={running}>
            {done ? 'Close' : 'Cancel'}
          </button>
          <button type="button" className="btn-primary" disabled={running || !ready} onClick={start}>
            {running ? 'Uploading…' : `Upload ${ready || ''}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <AlbumSelect albums={albums} value={albumId} onChange={setAlbumId} />
          <Field label="Caption (applies to all)" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} />
        </div>
        <button
          type="button"
          disabled={running}
          onClick={() => input.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-sand bg-cream/40 px-4 py-8 text-sm text-muted transition hover:border-gold hover:bg-cream"
        >
          <Upload className="size-6 text-gold" aria-hidden="true" />
          Choose photos, GIFs or videos
          <span className="text-xs">Photos are resized and stripped of location data before upload.</span>
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={MEDIA_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            pick(e.target.files ?? [])
            e.target.value = ''
          }}
        />
        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((i, n) => (
              <li key={`${i.file.name}-${n}`} className="rounded-xl border border-champagne bg-white/60 px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{i.file.name}</span>
                  <span className={`shrink-0 text-xs ${i.status === 'error' ? 'text-rose' : i.status === 'done' ? 'text-sage-deep' : 'text-muted'}`}>
                    {i.status === 'done' ? 'Uploaded' : i.status === 'uploading' ? `${Math.round(i.progress * 100)}%` : i.status === 'error' ? 'Failed' : 'Ready'}
                  </span>
                </div>
                {i.status === 'uploading' && <div className="mt-2"><ProgressBar value={i.progress} label={`Uploading ${i.file.name}`} /></div>}
                {i.error && <p className="mt-1 text-xs text-rose">{i.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

const EMPTY_ALBUM = { title: '', slug: '', description: '', is_public: true, is_guest_uploads: false, sort_order: 0 }

function AlbumsModal({ albums, onClose, onChanged }) {
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const action = useAction()

  const save = async (e) => {
    e.preventDefault()
    const body = {
      ...editing,
      slug: editing.id ? undefined : editing.slug || slugify(editing.title),
      description: editing.description || null,
      sort_order: Number(editing.sort_order) || 0,
    }
    if (await action.run(() => saveAlbum(editing.id ?? null, body), editing.id ? 'Album saved.' : 'Album created.')) {
      setEditing(null)
      onChanged()
    }
  }

  const remove = async () => {
    if (await action.run(() => deleteAlbum(removing.id), 'Album deleted.')) {
      setRemoving(null)
      onChanged()
    }
  }

  const set = (k) => (e) => setEditing((a) => ({ ...a, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  return (
    <Modal open onClose={onClose} title="Albums" wide>
      <ActionStatus error={!removing ? action.error : ''} notice={action.notice} />
      {editing ? (
        <form onSubmit={save} className="space-y-4">
          <Field label="Title" value={editing.title} onChange={set('title')} maxLength={80} required />
          {!editing.id && (
            <Field label="Short name (URL)" value={editing.slug || slugify(editing.title)} onChange={set('slug')} maxLength={60} hint="Lowercase letters, numbers and dashes." />
          )}
          <Field label="Description" as="textarea" value={editing.description ?? ''} onChange={set('description')} maxLength={500} />
          <Field label="Display order" type="number" value={editing.sort_order} onChange={set('sort_order')} className="sm:w-40" />
          <Checkbox label="Public" description="Visible in the guest gallery." checked={Boolean(Number(editing.is_public))} onChange={set('is_public')} />
          <Checkbox
            label="Guest uploads go here"
            description="Only one album can receive guest photos."
            checked={Boolean(Number(editing.is_guest_uploads))}
            onChange={set('is_guest_uploads')}
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
              Back
            </button>
            <button type="submit" className="btn-primary" disabled={action.busy}>
              {action.busy ? 'Saving…' : 'Save album'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <ul className="divide-y divide-champagne/70">
            {albums.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted">
                    {Number(a.is_public) ? 'Public' : 'Private'}
                    {Number(a.is_guest_uploads) ? ' · receives guest uploads' : ''}
                  </p>
                </div>
                <div className="flex">
                  <IconBtn label="Edit album" icon={Pencil} onClick={() => setEditing({ ...a, is_public: Boolean(Number(a.is_public)), is_guest_uploads: Boolean(Number(a.is_guest_uploads)) })} />
                  <IconBtn label="Delete album" icon={Trash2} danger onClick={() => setRemoving(a)} />
                </div>
              </li>
            ))}
          </ul>
          {albums.length === 0 && <p className="py-4 text-sm text-muted">No albums yet.</p>}
          <button type="button" className="btn-outline mt-4" onClick={() => setEditing(EMPTY_ALBUM)}>
            <FolderPlus className="size-4" aria-hidden="true" /> New album
          </button>
        </>
      )}
      <ConfirmDialog open={Boolean(removing)} title="Delete this album?" busy={action.busy} onConfirm={remove} onClose={() => setRemoving(null)}>
        {removing && (
          <>
            “{removing.title}” will be deleted. Its photos are not deleted — they are kept without an album.
            {action.error && <p className="mt-3 text-rose">{action.error}</p>}
          </>
        )}
      </ConfirmDialog>
    </Modal>
  )
}
