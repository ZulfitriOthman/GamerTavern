// Browser-side image preparation before upload:
// - decodes the photo honouring EXIF orientation
// - resizes the full image and a gallery thumbnail
// - re-encodes as JPEG, which also strips EXIF metadata (including GPS location)
// The server still validates type and size independently.

const FULL_MAX = 2400
const THUMB_MAX = 720

async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // fall through to <img> decoding (older Safari)
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function render(source, maxSide, quality) {
  const w = source.width
  const h = source.height
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff' // flatten transparent PNGs
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve({ blob, width: canvas.width, height: canvas.height }) : reject(new Error('encode'))),
      'image/jpeg',
      quality,
    ),
  )
}

/** Returns { full: {blob,width,height}, thumb: {blob,width,height} } or throws a friendly Error. */
export async function prepareImage(file) {
  let source
  try {
    source = await decode(file)
  } catch {
    throw new Error('This photo format could not be read on this device. Please try a JPEG or PNG.')
  }
  try {
    const full = await render(source, FULL_MAX, 0.86)
    const thumb = await render(source, THUMB_MAX, 0.8)
    return { full, thumb }
  } finally {
    source.close?.()
  }
}
