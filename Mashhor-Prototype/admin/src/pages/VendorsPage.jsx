// Client organisations ("Vendors" on screen — handover C7) and their portal
// accounts. Derived from the existing admin VendorsPage without the catalog
// (category access) column; the API calls are the existing ones.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Icon } from '@mashoor/shared/Icon'
import { Alert, ConfirmDialog, EmptyState, Field, Loading, Modal, PageHeader } from '@mashoor/shared/ui'
import { NewPasswordFields, RoleBadge, RoleSelect, UsernameInput } from '@legacy-admin/pages/AccountFields.jsx'
import { readNewPassword, required, usernameProblem } from '@legacy-admin/pages/accountForm.js'
import { StatusBadge } from '@legacy-admin/pages/StatusBadge.jsx'
import { api } from '../api.js'

export default function VendorsPage() {
  const navigate = useNavigate()
  const [vendors, setVendors] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState(null)
  const [actionError, setActionError] = useState('')
  const [creating, setCreating] = useState(false)
  const [deactivating, setDeactivating] = useState(null) // { vendor, account }
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    let cancelled = false
    api('/vendors').then(
      (data) => {
        if (cancelled) return
        setVendors(data.vendors)
        setLoadError('')
      },
      (err) => !cancelled && setLoadError(err.message),
    )
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  async function confirmDeactivate() {
    const { account } = deactivating
    setBusy(true)
    setActionError('')
    try {
      await api(`/vendor-users/${account.id}`, { method: 'PATCH', body: { active: false } })
      setNotice({ text: `${account.username ?? account.name} was deactivated and signed out. The account and its records are kept.` })
      setDeactivating(null)
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Vendors (organisations)"
        description="Client organisations, their portal accounts (inspectors, clients and signatories) and sign-off assignments."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus" /> Add organisation
          </button>
        }
      />

      {notice && (
        <Alert tone="success" onDismiss={() => setNotice(null)}>
          {notice.vendor ? (
            <>
              <strong>{notice.vendor.name}</strong> was created with username <strong>{notice.username}</strong>.{' '}
              <Link to={`/vendors/${notice.vendor.id}`}>Add its other accounts and assign the sign-off stages</Link>.
            </>
          ) : (
            notice.text
          )}
        </Alert>
      )}

      <section className="card" aria-label="Organisation list">
        {loadError && (
          <EmptyState
            tone="error"
            title="Organisations couldn’t load"
            actions={
              <button type="button" className="btn" onClick={reload}>
                Try again
              </button>
            }
          >
            {loadError}
          </EmptyState>
        )}
        {!vendors && !loadError && <Loading label="Loading organisations…" />}
        {vendors?.length === 0 && (
          <EmptyState
            icon="store"
            title="No organisations yet"
            actions={
              <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                <Icon name="plus" /> Add organisation
              </button>
            }
          >
            Add a client organisation with its first portal account.
          </EmptyState>
        )}
        {vendors?.length > 0 && (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Organisation</th>
                  <th scope="col">Portal accounts</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id}>
                    <td data-label="Organisation">
                      <div className="cell-main">
                        <Link className="cell-title" to={`/vendors/${v.id}`}>
                          {v.name}
                        </Link>
                        {v.registrationNo && <span className="cell-sub">Reg. no. {v.registrationNo}</span>}
                      </div>
                    </td>
                    <td data-label="Accounts">
                      {v.accounts.length === 0 ? (
                        <span className="muted">No accounts</span>
                      ) : (
                        <div style={{ display: 'grid', gap: '0.4rem' }}>
                          {v.accounts.map((a) => (
                            <div key={a.id} className="media-row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                              <span style={{ fontWeight: 550, overflowWrap: 'anywhere' }}>{a.username ?? <em className="muted">no username</em>}</span>
                              <span className="subtle">{a.name}</span>
                              <RoleBadge role={a.role} />
                              <StatusBadge active={a.active} inactiveLabel="Deactivated" />
                              {a.active ? (
                                <button
                                  type="button"
                                  className="btn-link danger"
                                  onClick={() => {
                                    setActionError('')
                                    setDeactivating({ vendor: v, account: a })
                                  }}
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button type="button" className="btn-link" onClick={() => navigate(`/vendors/${v.id}?reactivate=${a.id}`)}>
                                  Reactivate…
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td data-label="Status">
                      <StatusBadge active={v.status === 'active'} inactiveLabel="Suspended" />
                    </td>
                    <td data-label="" className="col-actions">
                      <Link className="btn btn-sm" to={`/vendors/${v.id}`}>
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={creating} onClose={() => setCreating(false)} wide title="Add organisation" description="Create the client organisation and its first portal account.">
        <CreateVendorForm
          onCancel={() => setCreating(false)}
          onCreated={(result) => {
            setCreating(false)
            setNotice({ vendor: result.vendor, username: result.user.username })
            reload()
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivating)}
        title="Deactivate portal account?"
        description={
          deactivating &&
          `${deactivating.account.username ?? deactivating.account.name} (${deactivating.vendor.name}) is signed out now and can’t sign in until reactivated with a new password.`
        }
        confirmLabel="Deactivate"
        busy={busy}
        error={actionError}
        onConfirm={confirmDeactivate}
        onCancel={() => setDeactivating(null)}
      />
    </>
  )
}

function CreateVendorForm({ onCancel, onCreated }) {
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = readNewPassword(form)
    const next = {
      name: required(form.get('name'), 'Enter the organisation name.'),
      contactName: required(form.get('contactName'), 'Enter the person’s full name.'),
      username: usernameProblem(form.get('username')),
      ...(password.errors ?? {}),
    }
    Object.keys(next).forEach((key) => !next[key] && delete next[key])
    setErrors(next)
    setServerError('')
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const result = await api('/vendors', {
        method: 'POST',
        body: {
          name: form.get('name'),
          registrationNo: form.get('registrationNo'),
          account: { name: form.get('contactName'), username: form.get('username'), role: form.get('role'), ...password },
        },
      })
      onCreated(result)
    } catch (err) {
      if (err.status === 409) setErrors({ username: err.message })
      else setServerError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="dialog-body">
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        <div className="form-section">
          <div className="form-section-head">
            <h3>Organisation</h3>
          </div>
          <div className="form-grid">
            <Field label="Organisation name" error={errors.name}>
              <input className="input" name="name" maxLength={200} />
            </Field>
            <Field label="Registration no." optional>
              <input className="input" name="registrationNo" maxLength={100} />
            </Field>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-head">
            <h3>First portal account</h3>
            <p>Portal accounts sign in with a username (not an email address). Signatories type this full name to confirm a sign-off.</p>
          </div>
          <div className="form-grid">
            <Field label="Full name" error={errors.contactName}>
              <input className="input" name="contactName" maxLength={200} />
            </Field>
            <UsernameInput error={errors.username} />
            <RoleSelect />
            <NewPasswordFields label="Password" error={errors} />
          </div>
        </div>
      </div>
      <div className="dialog-foot">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Creating…' : 'Create organisation'}
        </button>
      </div>
    </form>
  )
}
