// Display labels for vehicle inspections, shared by the admin site and portal.
// The workflow itself is enforced by the API (Backend/mashoor/src/inspections.js).

export const VEHICLE_TYPES = ['FORKLIFT', 'DOUBLE CAB HILUX', 'MEDIUM BUS', 'LARGE BUS']

export const INSPECTION_STATUS = {
  assigned: { label: 'Assigned', tone: '' },
  draft: { label: 'In progress', tone: '' },
  pending_verification: { label: 'Pending client verification', tone: 'warning' },
  returned: { label: 'Re-check requested', tone: 'danger' },
  pending_approval: { label: 'Pending HOO approval', tone: 'accent' },
  approved: { label: 'Approved', tone: 'success' },
}

export const STAGE_LABELS = {
  checked_by: 'Checked by',
  agreed_by: 'Agreed by',
  approved_by: 'Approved by (Head of Operation)',
  acknowledgement: 'Acknowledgement',
}

export const ROLE_LABELS = { client: 'Vendor / Client', inspector: 'Inspector' }

export const EVENT_LABELS = {
  created: 'Inspection created',
  updated: 'Inspection details updated',
  started: 'Checklist started',
  submitted: 'Submitted for client verification',
  resubmitted: 'Resubmitted after re-check',
  recheck_requested: 'Re-check requested',
  submitted_for_approval: 'Verified and submitted to HOO approval',
  'acknowledgement.auto': 'Auto-acknowledged — no remarks',
  'signed.checked_by': 'Confirmed as Checked by',
  'signed.agreed_by': 'Confirmed as Agreed by',
  'signed.approved_by': 'Approved by Head of Operation',
  'signed.acknowledgement': 'Acknowledged',
}

// "WXY 1234 · FORKLIFT" — the first available identifier plus the type.
export function vehicleTitle(vehicle) {
  const id = vehicle.plate || vehicle.registrationNo || vehicle.modRegistrationNo || 'Vehicle'
  return `${id} · ${vehicle.type}`
}
