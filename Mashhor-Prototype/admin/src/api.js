import { createApi } from '@mashoor/shared/api'

// Staff API of the existing Mashoor module (Backend/mashoor/src/routes/admin.js).
export const api = createApi('/api/mashoor/admin')

// Staff may view any damage diagram through the admin API.
export const diagramUrl = (_inspectionId, definition) =>
  definition?.damage?.enabled && definition.damage.diagramId ? `/api/mashoor/admin/checklist-diagrams/${definition.damage.diagramId}/image` : null
