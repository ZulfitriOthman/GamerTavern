// Photo, GIF and video storage, publication and visibility.
//
// Guest uploads are published IMMEDIATELY (status 'approved') once the file has
// been fully validated, processed and stored and its database row inserted —
// an incomplete or failed upload never becomes visible. The couple can still
// hide ('rejected') or delete anything afterwards from the dashboard.
// Existing rows are never changed by an upload.
import { config } from '../config.js'
import { newId } from '../lib/crypto.js'
import { AppError, badRequest, forbidden, notFound } from '../lib/errors.js'
import { processImage } from '../lib/images.js'
import { processUpload } from '../lib/media.js'
import { moveIntoPlace, removeFiles, removeTemp, saveFile } from '../lib/storage.js'
import { text, uuid } from '../lib/validate.js'
import { requireSettings } from './content.js'
import { consume, enforce } from './rateLimit.js'

const MB = 1024 * 1024

// --- schema compatibility ---------------------------------------------------
// media_type / mime_type are added by database/migrations/010. Until that has
// been run, the API keeps working for photos exactly as before and GIF/video
// uploads are declined politely. Once present, the answer is cached for good;
// while absent it is re-checked at most once a minute.
let mediaColumns = { value: false, checkedAt: 0 }
export async function hasMediaColumns(db) {
  if (mediaColumns.value || Date.now() - mediaColumns.checkedAt < 60_000) return mediaColumns.value
  const [rows] = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'wedding_photos' AND column_name IN ('media_type', 'mime_type')`,
  )
  mediaColumns = { value: Number(rows[0].n) === 2, checkedAt: Date.now() }
  return mediaColumns.value
}

const mediaSelect = (has) => (has ? 'p.media_type, p.mime_type' : "'image' AS media_type, 'image/jpeg' AS mime_type")

const PUBLIC_COLUMNS = `p.id, p.album_id, p.caption, p.uploader_name, p.source, p.width, p.height, p.sort_order,
  p.created_at, p.updated_at, (p.thumb_key <> p.storage_key) AS has_thumb`

/** URLs are relative to the API root (the frontend prefixes its API base URL). */
export function withUrls(row) {
  const { has_thumb: hasThumbRaw, ...rest } = row
  const v = new Date(row.updated_at ?? Date.now()).getTime()
  const mediaType = row.media_type ?? 'image'
  const hasThumb = hasThumbRaw === undefined || Number(hasThumbRaw) === 1
  const thumb = `/media/photos/${row.id}/thumb?v=${v}`
  return {
    ...rest,
    media_type: mediaType,
    url: `/media/photos/${row.id}/full?v=${v}`,
    // Videos: the thumbnail is the poster image. Without one the client shows the video's first frame.
    thumbUrl: mediaType === 'video' && !hasThumb ? null : thumb,
    posterUrl: mediaType === 'video' && hasThumb ? thumb : null,
  }
}

// Media is public when approved and either album-less or in a public album.
const PUBLIC_WHERE = `p.status = 'approved' AND (p.album_id IS NULL OR EXISTS (
  SELECT 1 FROM wedding_albums a WHERE a.id = p.album_id AND a.is_public = 1))`

export async function listApproved(db, limit) {
  const n = Math.max(1, Math.min(500, Number.parseInt(limit, 10) || 200))
  const has = await hasMediaColumns(db)
  const [rows] = await db.query(
    `SELECT ${PUBLIC_COLUMNS}, ${mediaSelect(has)} FROM wedding_photos p WHERE ${PUBLIC_WHERE}
      ORDER BY p.sort_order, p.created_at DESC, p.id DESC LIMIT ?`,
    [n],
  )
  return rows.map(withUrls)
}

/** Returns the stored file key for a media variant, enforcing visibility. */
export async function fileForRequest(db, id, variant, isAdmin) {
  if (!['full', 'thumb'].includes(variant)) throw notFound()
  let photoId
  try {
    photoId = uuid(id)
  } catch {
    throw notFound()
  }
  const [rows] = await db.query(
    `SELECT p.storage_key, p.thumb_key, (${PUBLIC_WHERE}) AS is_public FROM wedding_photos p WHERE p.id = ?`,
    [photoId],
  )
  const row = rows[0]
  // Rejected / pending / private-album media look identical to missing ones for guests.
  if (!row || (!Number(row.is_public) && !isAdmin)) throw notFound()
  return { key: variant === 'thumb' ? row.thumb_key : row.storage_key, isPublic: Boolean(Number(row.is_public)) }
}

async function checkQuota(db, incomingBytes) {
  const [[{ used }]] = await db.query('SELECT COALESCE(SUM(byte_size), 0) AS used FROM wedding_photos')
  if (Number(used) + incomingBytes > config.uploads.quotaMb * MB) {
    throw new AppError(507, 'STORAGE_FULL', 'Photo storage is full. Please contact the couple.')
  }
}

/**
 * Validates, processes and stores one upload, then inserts its row. Files are
 * written first and the row last, so nothing is listed until it is complete;
 * on any failure the stored files are removed again.
 */
async function storeMedia(db, file, poster, fields, meta) {
  const media = await processUpload(file, poster, fields)
  const has = await hasMediaColumns(db)
  if (media.mediaType !== 'image' && !has) {
    throw new AppError(503, 'MEDIA_TYPES_UNAVAILABLE', 'GIFs and videos cannot be shared just yet — photos can. Please try again later.')
  }
  const bytes = (media.fullBuffer ? media.fullBuffer.length : file.size) + (media.thumbBuffer?.length ?? 0)
  await checkQuota(db, bytes)

  const id = newId()
  const month = new Date().toISOString().slice(0, 7)
  const storageKey = `photos/${month}/${id}.${media.ext}`
  const thumbKey = media.thumbBuffer ? `photos/${month}/${id}_thumb.${media.mediaType === 'gif' ? 'gif' : 'jpg'}` : storageKey
  try {
    if (media.fullBuffer) await saveFile(storageKey, media.fullBuffer)
    else await moveIntoPlace(media.fullTempPath, storageKey)
    if (media.thumbBuffer) await saveFile(thumbKey, media.thumbBuffer)
    const cols = ['id', 'album_id', 'storage_key', 'thumb_key', 'caption', 'uploader_name', 'source', 'status', 'width', 'height', 'byte_size', 'consent_at']
    const vals = [id, meta.albumId, storageKey, thumbKey, meta.caption, meta.uploaderName, meta.source, 'approved', media.width, media.height, bytes, meta.consentAt]
    if (has) {
      cols.push('media_type', 'mime_type')
      vals.push(media.mediaType, media.mimeType)
    }
    await db.query(`INSERT INTO wedding_photos (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals)
  } catch (error) {
    await removeFiles([storageKey, thumbKey])
    throw error
  }
  const [rows] = await db.query(`SELECT ${PUBLIC_COLUMNS}, ${mediaSelect(has)} FROM wedding_photos p WHERE p.id = ?`, [id])
  return withUrls(rows[0])
}

/** Guest upload: published immediately, into the guest-uploads album. */
export async function guestUpload(db, files, body, ip) {
  const file = files?.photo?.[0]
  const poster = files?.poster?.[0]
  try {
    const settings = await requireSettings(db)
    if (!settings.photo_uploads_enabled) throw forbidden('Photo sharing is not open right now.')
    if (text(body.website, { field: 'website', max: 200 })) return { status: 'published' } // honeypot: nothing stored
    if (!file) throw badRequest('Please choose a photo, GIF or video to upload.')
    const uploaderName = text(body.name, { field: 'your name', max: 80, required: true })
    const caption = text(body.caption, { field: 'the caption', max: 300 })
    if (body.consent !== 'true') throw badRequest('Please confirm the sharing notice before uploading.')

    const busy = 'You have shared a lot in a short time — thank you! Please try again a little later.'
    await enforce(
      db,
      [
        ['upload', ip, 40, 3600],
        ['upload-day', ip, 150, 86400],
        ['upload-global', 'all', 1500, 3600],
      ],
      busy,
    )
    // Bound the volume each visitor can add: one unit per started 10 MB, 300 units (≈3 GB) per day.
    const units = Math.max(1, Math.ceil(file.size / (10 * MB)))
    for (let i = 0; i < units; i++) {
      if (!(await consume(db, 'upload-volume', ip, 300, 86400))) throw new AppError(429, 'RATE_LIMITED', busy)
    }

    const [albums] = await db.query('SELECT id FROM wedding_albums WHERE is_guest_uploads = 1 LIMIT 1')
    const item = await storeMedia(db, file, poster, body, {
      albumId: albums[0]?.id ?? null,
      caption,
      uploaderName,
      source: 'guest',
      consentAt: new Date(),
    })
    return { status: 'published', item }
  } finally {
    await removeTemp([file?.path, poster?.path])
  }
}

/** Admin upload: photos, GIFs or videos, published immediately. */
export async function officialUpload(db, files, body) {
  const file = files?.photo?.[0]
  const poster = files?.poster?.[0]
  try {
    if (!file) throw badRequest('Please choose a photo, GIF or video to upload.')
    const albumId = body.album_id ? uuid(body.album_id, 'album') : null
    const caption = text(body.caption, { field: 'the caption', max: 300 })
    return await storeMedia(db, file, poster, body, { albumId, caption, uploaderName: null, source: 'official', consentAt: null })
  } finally {
    await removeTemp([file?.path, poster?.path])
  }
}

/** Hero / story images for the public site. */
export async function uploadSiteAsset(file) {
  if (!file?.buffer?.length) throw badRequest('Please choose an image.')
  const processed = await processImage(file.buffer, { thumbnail: false })
  const key = `site/${newId()}.jpg`
  await saveFile(key, processed.full)
  return { url: `/media/${key}` }
}

export async function listForAdmin(db, status) {
  const where = ['pending', 'approved', 'rejected'].includes(status) ? 'WHERE p.status = ?' : ''
  const has = await hasMediaColumns(db)
  const [rows] = await db.query(
    `SELECT p.id, p.album_id, p.caption, p.uploader_name, p.source, p.status, p.width, p.height, p.byte_size, p.sort_order,
            p.consent_at, p.created_at, p.updated_at, (p.thumb_key <> p.storage_key) AS has_thumb, ${mediaSelect(has)}
       FROM wedding_photos p ${where} ORDER BY p.created_at DESC LIMIT 500`,
    where ? [status] : [],
  )
  return rows.map(withUrls)
}

export async function updatePhoto(db, id, body) {
  const sets = []
  const params = []
  if (body.status !== undefined) {
    if (!['pending', 'approved', 'rejected'].includes(body.status)) throw badRequest('Invalid status.')
    sets.push('status = ?')
    params.push(body.status)
  }
  if (body.caption !== undefined) {
    sets.push('caption = ?')
    params.push(text(body.caption, { field: 'the caption', max: 300 }))
  }
  if (body.album_id !== undefined) {
    sets.push('album_id = ?')
    params.push(body.album_id ? uuid(body.album_id, 'album') : null)
  }
  if (body.sort_order !== undefined) {
    const n = Number(body.sort_order)
    if (!Number.isInteger(n) || Math.abs(n) > 1_000_000) throw badRequest('Invalid order.')
    sets.push('sort_order = ?')
    params.push(n)
  }
  if (!sets.length) throw badRequest('Nothing to update.')
  const [result] = await db.query(`UPDATE wedding_photos SET ${sets.join(', ')} WHERE id = ?`, [...params, uuid(id)])
  if (!result.affectedRows) throw notFound('Photo not found.')
}

export async function deletePhoto(db, id) {
  const [rows] = await db.query('SELECT storage_key, thumb_key FROM wedding_photos WHERE id = ?', [uuid(id)])
  if (!rows[0]) throw notFound('Photo not found.')
  await db.query('DELETE FROM wedding_photos WHERE id = ?', [id])
  await removeFiles([rows[0].storage_key, rows[0].thumb_key])
}
