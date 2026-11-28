// Where an inspection is in its life, as five steps for the journey strip.
// Pure: built from the inspection and viewer objects the portal API already
// returns; `day` formats a date (injected so this runs without the app).
//
// Step state: 'done' | 'now' (waiting on someone else) | 'yours' (waiting on
// the viewer) | 'next' (not reached) | 'approved' (final step, finished).

const SIGNOFF_STAGES = ['acknowledgement', 'checked_by', 'agreed_by']
const STAGE_TEXT = { acknowledgement: 'Acknowledgement', checked_by: 'Checked by', agreed_by: 'Agreed by' }

export function journeySteps(inspection, viewer, day = (value) => value) {
  const { status } = inspection
  const current = inspection.revisions.find((r) => r.current)
  const submitted = !['assigned', 'draft'].includes(status) && Boolean(current)
  const signed = new Set((current?.signoffs ?? []).map((s) => s.stage))
  const done = (stage) => (stage === 'acknowledgement' ? ['auto', 'acknowledged'].includes(current?.acknowledgement) : signed.has(stage))
  const mine = (stage) => viewer.stages?.find((s) => s.stage === stage && !s.signed && !s.blockedReason)
  const assignee = (stage) => inspection.signatories.find((s) => s.stage === stage)?.assignee?.name
  const lastEvent = (action) => inspection.events.filter((e) => e.action === action).at(-1)

  const assigned = { label: 'Assigned', state: 'done', sub: `${day(inspection.createdAt)} · ${inspection.inspector.name}` }

  let checklist
  if (status === 'returned' || !submitted) {
    const recheck = status === 'returned'
    checklist = viewer.canEdit
      ? { state: 'yours', sub: recheck ? 'Your turn: re-check' : 'Your turn' }
      : { state: 'now', sub: `Waiting for ${inspection.inspector.name}${recheck ? ' to re-check' : ''}` }
  } else {
    checklist = { state: 'done', sub: `Revision ${current.revision} · ${day(current.submittedAt)}` }
  }

  let review
  if (status === 'pending_verification') {
    review = viewer.canVerify ? { state: 'yours', sub: 'Your turn' } : { state: 'now', sub: `Waiting for ${inspection.company.name}` }
  } else if (status === 'returned') {
    review = { state: 'next', sub: `Re-check requested ${day(lastEvent('recheck_requested')?.at)}` }
  } else if (status === 'pending_approval' || status === 'approved') {
    review = { state: 'done', sub: current.verifiedBy ? `Verified by ${current.verifiedBy.name}` : 'Verified' }
  } else {
    review = { state: 'next', sub: 'Not yet' }
  }

  const confirmed = SIGNOFF_STAGES.filter(done).length
  const myStage = submitted && SIGNOFF_STAGES.find(mine)
  const waitingFor = SIGNOFF_STAGES.filter((s) => !done(s)).map((s) => assignee(s) ?? STAGE_TEXT[s])
  let signoffs
  if (confirmed === SIGNOFF_STAGES.length) signoffs = { state: 'done', sub: `${confirmed} of ${SIGNOFF_STAGES.length} confirmed` }
  else if (myStage) signoffs = { state: 'yours', sub: `Your turn: ${STAGE_TEXT[myStage]}` }
  // After verification (and after approval, where acknowledgement may still be open) the remaining sign-offs are what's being waited on.
  else if (status === 'pending_approval' || status === 'approved') {
    signoffs = { state: 'now', sub: `${confirmed} of ${SIGNOFF_STAGES.length} · waiting for ${waitingFor.join(', ')}` }
  } else signoffs = { state: 'next', sub: submitted ? `${confirmed} of ${SIGNOFF_STAGES.length} confirmed` : 'Not yet' }

  let approval
  if (status === 'approved') {
    const by = current?.signoffs.find((s) => s.stage === 'approved_by')?.name
    approval = { state: 'approved', sub: `Approved ${day(inspection.approvedAt)}${by ? ` · ${by}` : ''}` }
  } else if (status === 'pending_approval') {
    approval = mine('approved_by') ? { state: 'yours', sub: 'Your turn' } : { state: 'now', sub: `Waiting for ${assignee('approved_by') ?? 'the Head of Operation'}` }
  } else {
    approval = { state: 'next', sub: 'Not yet' }
  }

  return [
    assigned,
    { label: 'Checklist submitted', ...checklist },
    { label: 'Client review', ...review },
    { label: 'Sign-offs', ...signoffs },
    { label: 'Head of Operation approval', ...approval },
  ]
}
