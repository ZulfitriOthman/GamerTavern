import { useEffect, useState } from 'react'
import { STAGE_LABELS } from '@mashoor/shared/inspection'
import { Field, Loading } from '@mashoor/shared/ui'
import { api } from '../api.js'

const STAGE_HINTS = {
  checked_by: 'Confirms the submitted checklist as checked.',
  agreed_by: 'Confirms agreement with the submitted checklist.',
  approved_by: 'Head of Operation — gives final approval after client verification.',
  acknowledgement: 'Acknowledges checklists that contain remarks (e.g. Ali bin Haji Abd Rahman’s account).',
}

// Per-company mapping of each sign-off stage to one explicit login account.
// Nobody holds a stage until it is assigned here.
export function InspectionSettings({ vendor, users, onSaved, onError }) {
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const active = users.filter((u) => u.active)

  useEffect(() => {
    let cancelled = false
    api(`/vendors/${vendor.id}/inspection-settings`).then(
      (data) => !cancelled && setSettings(data),
      (err) => !cancelled && onError(err.message),
    )
    return () => {
      cancelled = true
    }
  }, [vendor.id, onError])

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const signatories = Object.fromEntries(Object.keys(STAGE_LABELS).map((stage) => [stage, form.get(stage) ? Number(form.get(stage)) : null]))
    setSaving(true)
    try {
      await api(`/vendors/${vendor.id}/inspection-settings`, {
        method: 'PUT',
        body: { signatories, ackBlocksApproval: form.get('ackBlocksApproval') === 'on' },
      })
      onSaved('Inspection sign-off assignments saved.')
    } catch (err) {
      onError(err.message)
      setSaving(false)
    }
  }

  return (
    <section className="card" aria-labelledby="signoff-title">
      <div className="card-head">
        <div>
          <h2 id="signoff-title">Inspection sign-offs</h2>
          <p>
            Who may confirm each stage for {vendor.name}’s vehicle inspections. Each person confirms from their own portal
            account by re-entering their full name.
          </p>
        </div>
      </div>
      {!settings ? (
        <Loading />
      ) : (
        <form className="card-body form-stack" onSubmit={handleSubmit}>
          <div className="form-grid">
            {settings.signatories.map((s) => (
              <Field
                key={s.stage}
                label={STAGE_LABELS[s.stage]}
                hint={
                  settings.templateCaptions?.[s.stage]?.length
                    ? `${STAGE_HINTS[s.stage]} The checklist form prints: ${settings.templateCaptions[s.stage].join(' / ')}. Choose the account of that person — the label alone grants nothing.`
                    : STAGE_HINTS[s.stage]
                }
              >
                <select className="select" name={s.stage} defaultValue={s.assignee?.id ?? ''}>
                  <option value="">Not assigned</option>
                  {s.assignee && !s.assignee.active && (
                    <option value={s.assignee.id}>{s.assignee.name} (deactivated)</option>
                  )}
                  {active.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.username ?? 'no username'}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" name="ackBlocksApproval" defaultChecked={settings.ackBlocksApproval} />
            Head of Operation can approve only after a pending acknowledgement is completed
          </label>
          <div className="form-actions start">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save sign-off assignments'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
