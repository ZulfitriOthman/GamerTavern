const SUBMISSION = ['submitted', 'resubmitted']

/**
 * Events of one revision: those recorded against it, plus the unnumbered
 * events (created, reassigned, started…) that happened before it was submitted.
 */
export function eventsForRevision(events, revisionNumber) {
  const out = []
  let waiting = []
  for (const e of events) {
    if (e.revision == null) {
      waiting.push(e)
      continue
    }
    if (SUBMISSION.includes(e.action)) {
      if (e.revision === revisionNumber) out.push(...waiting)
      waiting = []
    }
    if (e.revision === revisionNumber) out.push(e)
  }
  return out
}
