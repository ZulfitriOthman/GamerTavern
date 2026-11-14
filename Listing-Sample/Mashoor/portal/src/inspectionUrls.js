// Damage-diagram image for an inspection, served by the access-checked portal API.
export const diagramUrlFor = (inspectionId, definition) =>
  definition?.damage?.enabled && definition.damage.diagramId ? `/api/mashoor/portal/inspections/${inspectionId}/diagrams/${definition.damage.diagramId}` : null
