import { createApi } from '@mashoor/shared/api'

// Portal API of the existing Mashoor module (Backend/mashoor/src/routes/portal.js).
// Organisation, role and assignment checks all happen there.
export const api = createApi('/api/mashoor/portal')

// Damage-diagram image for an inspection, served by the access-checked portal API.
export const diagramUrl = (inspectionId, definition) =>
  definition?.damage?.enabled && definition.damage.diagramId ? `/api/mashoor/portal/inspections/${inspectionId}/diagrams/${definition.damage.diagramId}` : null
