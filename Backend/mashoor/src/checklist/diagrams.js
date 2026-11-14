// Damage-diagram images. Two kinds of file:
//   'asset:<name>'  shipped with the backend (cropped from the client's PDF),
//                   read from Backend/mashoor/assets/checklist-diagrams;
//   '<random>.<ext>' uploaded by staff, kept in private storage
//                   (MASHOOR_STORAGE_DIR/diagrams), never in Backend/public.
// Both are only served through API routes that check access first.
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createImageStore, sendImage } from '../images.js'

const ASSET_DIR = fileURLToPath(new URL('../../assets/checklist-diagrams', import.meta.url))
const ASSET_NAME = /^asset:([a-z0-9-]{1,60}\.(jpg|png|webp))$/

export function createDiagramStore(storageDir) {
  const uploads = createImageStore(storageDir, 'diagrams')
  return {
    save: (buffer, type) => uploads.save(buffer, type),
    remove: (name) => uploads.remove(name),
    // Absolute path of a stored diagram, or null when the name isn't one of ours.
    path(file) {
      const asset = typeof file === 'string' && file.match(ASSET_NAME)
      if (asset) return join(ASSET_DIR, asset[1])
      return uploads.path(file)
    },
  }
}

export function getDiagram(db, id) {
  return db.prepare('SELECT * FROM checklist_diagrams WHERE id = ?').get(id)
}

export const toDiagram = (row, urlBase) => ({
  id: row.id,
  name: row.name,
  vehicleType: row.vehicle_type,
  source: row.source,
  builtIn: row.file.startsWith('asset:'),
  createdAt: row.created_at,
  ...(urlBase && { url: `${urlBase}/${row.id}/image` }),
})

export function sendDiagram(res, store, row) {
  sendImage(res, { path: (name) => store.path(name) }, row.file, row.mime_type)
}
