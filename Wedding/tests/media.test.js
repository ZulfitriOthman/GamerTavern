import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { mediaFormData } from '../src/lib/mediaUpload.js'
import { checkMediaFile, LIMITS, mediaKind } from '../src/lib/validation.js'
import { listApprovedPhotos, uploadGuestMedia } from '../src/services/photoService.js'

const file = (name, type, size = 1000) => ({ name, type, size })
const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

describe('picking files (client-side hints; the server re-checks signatures)', () => {
  it('classifies photos, GIFs and videos', () => {
    assert.equal(mediaKind(file('a.jpg', 'image/jpeg')), 'image')
    assert.equal(mediaKind(file('a.HEIC', '')), 'image')
    assert.equal(mediaKind(file('party.gif', 'image/gif')), 'gif')
    assert.equal(mediaKind(file('clip.mp4', 'video/mp4')), 'video')
    assert.equal(mediaKind(file('clip.webm', '')), 'video')
    assert.equal(mediaKind(file('page.html', 'text/html')), null)
  })
  it('explains unsupported formats and per-type size limits', () => {
    assert.match(checkMediaFile(file('iphone.MOV', 'video/quicktime')), /MP4 or WebM/)
    assert.match(checkMediaFile(file('x.exe', 'application/x-msdownload')), /Only photos/)
    assert.match(checkMediaFile(file('big.mp4', 'video/mp4', LIMITS.maxVideoBytes + 1)), /too large/)
    assert.match(checkMediaFile(file('big.gif', 'image/gif', LIMITS.maxGifBytes + 1)), /too large/)
    assert.equal(checkMediaFile(file('ok.mp4', 'video/mp4', 50 * 1024 * 1024)), null)
  })
})

describe('upload form', () => {
  it('sends the media file, poster and dimensions', () => {
    const form = mediaFormData(
      { kind: 'video', blob: new Blob(['v']), filename: 'video.mp4', width: 1920, height: 1080, poster: new Blob(['p']) },
      { name: 'Guest', caption: '', consent: 'true' },
    )
    assert.deepEqual([...form.keys()].sort(), ['consent', 'height', 'name', 'photo', 'poster', 'width'])
    assert.equal(form.get('photo').name, 'video.mp4')
  })
})

describe('gallery items', () => {
  it('keeps media type and resolves poster URLs for videos', async () => {
    globalThis.fetch = async () =>
      Response.json({
        success: true,
        photos: [
          { id: 'v1', media_type: 'video', url: '/media/photos/v1/full?v=1', thumbUrl: null, posterUrl: '/media/photos/v1/thumb?v=1' },
          { id: 'g1', media_type: 'gif', url: '/media/photos/g1/full?v=1', thumbUrl: '/media/photos/g1/thumb?v=1', posterUrl: null },
        ],
      })
    const [video, gif] = await listApprovedPhotos()
    assert.equal(video.posterUrl, '/api/wedding/media/photos/v1/thumb?v=1')
    assert.equal(video.thumbUrl, null)
    assert.equal(gif.media_type, 'gif')
  })
})

describe('uploadGuestMedia(): success only when the file is really public', () => {
  // XMLHttpRequest is browser-only; emulate the upload response.
  const withXhr = (status, body) => {
    globalThis.XMLHttpRequest = class {
      upload = {}
      open() {}
      setRequestHeader() {}
      send() {
        this.status = status
        this.responseText = JSON.stringify(body)
        queueMicrotask(() => this.onload())
      }
    }
  }
  const prepared = { kind: 'image', blob: new Blob(['x']), filename: 'photo.jpg' }
  const published = { success: true, status: 'published', item: { id: 'p1', media_type: 'image', url: '/media/photos/p1/full?v=1', thumbUrl: '/media/photos/p1/thumb?v=1' } }

  it('resolves with the published item once the media URL answers 200', async () => {
    withXhr(201, published)
    globalThis.fetch = async (url, init) => {
      assert.equal(init.method, 'HEAD')
      assert.equal(url, '/api/wedding/media/photos/p1/full?v=1')
      return new Response(null, { status: 200 })
    }
    const item = await uploadGuestMedia(prepared, { name: 'Guest' })
    assert.equal(item.id, 'p1')
  })
  it('fails if the server accepted it but the file is not reachable', async () => {
    withXhr(201, published)
    globalThis.fetch = async () => new Response(null, { status: 404 })
    await assert.rejects(uploadGuestMedia(prepared, { name: 'Guest' }), (e) => e.code === 'NOT_ACCESSIBLE')
  })
  it('fails (no fake success) when the response is not a published item', async () => {
    withXhr(201, { success: true, status: 'published' })
    await assert.rejects(uploadGuestMedia(prepared, { name: 'Guest' }), (e) => e.code === 'INVALID_RESPONSE')
  })
  it('surfaces the server error message', async () => {
    withXhr(415, { success: false, code: 'UNSUPPORTED_FILE_TYPE', message: 'Only photos (JPEG, PNG, WebP), GIFs and videos (MP4, WebM) can be uploaded.' })
    await assert.rejects(uploadGuestMedia(prepared, { name: 'Guest' }), (e) => /Only photos/.test(e.userMessage))
  })
})
