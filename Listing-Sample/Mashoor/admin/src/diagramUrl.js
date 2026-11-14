// Staff can view any damage diagram through the admin API.
export const diagramUrl = (id) => (id ? `/api/mashoor/admin/checklist-diagrams/${id}/image` : null)
