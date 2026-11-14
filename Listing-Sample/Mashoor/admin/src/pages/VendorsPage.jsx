import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Icon } from '@mashoor/shared/Icon'
import { Alert, ConfirmDialog, EmptyState, Field, Loading, Modal, PageHeader } from '@mashoor/shared/ui'
import { api } from '../api.js'
import { NewPasswordFields, RoleBadge, RoleSelect, UsernameInput } from './AccountFields.jsx'
import { readNewPassword, required, usernameProblem } from './accountForm.js'
import { StatusBadge } from './StatusBadge.jsx'

export default function VendorsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [vendors, setVendors] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState(null)
  const [actionError, setActionError] = useState('')
  const [creating, setCreating] = useState(() => params.get('new') === '1')
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

  function closeCreate() {
    setCreating(false)
    if (params.has('new')) setParams(new URLSearchParams(), { replace: true })
  }

  async function confirmDeactivate() {
    const { account } = deactivating
    setBusy(true)
    setActionError('')
    try {
      await api(`/vendor-users/${account.id}`, { method: 'PATCH', body: { active: false } })
      setNotice({ tone: 'success', text: `${account.username ?? account.name} was deactivated and signed out. The account and its categories are kept.` })
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
        title="Vendors"
        description="Vendor companies and the login accounts that can browse their assigned categories."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus" /> Add vendor
          </button>
        }
      />

      {notice && (
        <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.vendor ? (
            <>
              <strong>{notice.vendor.name}</strong> was created with username <strong>{notice.username}</strong>. Share the
              username and password with the vendor, then{' '}
              <Link to={`/vendors/${notice.vendor.id}`}>assign categories</Link> — until then their catalog is empty.
            </>
          ) : (
            notice.text
          )}
        </Alert>
      )}

      <section className="card" aria-label="Vendor list">
        {loadError && (
          <EmptyState
            tone="error"
            title="Vendors couldn’t load"
            actions={
              <button type="button" className="btn" onClick={reload}>
                Try again
              </button>
            }
          >
            {loadError}
          </EmptyState>
        )}
        {!vendors && !loadError && <Loading label="Loading vendors…" />}
        {vendors?.length === 0 && (
          <EmptyState
            icon="store"
            title="No vendors yet"
            actions={
              <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                <Icon name="plus" /> Add vendor
              </button>
            }
          >
            Add a vendor company with its login account, then choose which categories it can browse.
          </EmptyState>
        )}
        {vendors?.length > 0 && (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Vendor</th>
                  <th scope="col">Login accounts</th>
                  <th scope="col">Categories</th>
                  <th scope="col">Company</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id}>
                    <td data-label="Vendor">
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
                              <span style={{ fontWeight: 550, overflowWrap: 'anywhere' }}>
                                {a.username ?? <em className="muted">no username</em>}
                              </span>
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
                    <td data-label="Categories" className="num">
                      {v.categoryCount === 0 ? <span className="badge warning">None assigned</span> : `${v.categoryCount} assigned`}
                    </td>
                    <td data-label="Company">
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

      <Modal
        open={creating}
        onClose={closeCreate}
        wide
        title="Add vendor"
        description="Create the vendor company and the login account its staff will use."
      >
        <CreateVendorForm
          onCancel={closeCreate}
          onCreated={(result) => {
            closeCreate()
            setNotice({ tone: 'success', vendor: result.vendor, username: result.user.username })
            reload()
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivating)}
        title="Deactivate login account?"
        description={
          deactivating &&
          `${deactivating.account.username ?? deactivating.account.name} (${deactivating.vendor.name}) is signed out now and can’t sign in until reactivated with a new password. The account, username and categories are kept.`
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
      name: required(form.get('name'), 'Enter the company or vendor name.'),
      contactName: required(form.get('contactName'), 'Enter the contact person’s name.'),
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
            <h3>Company</h3>
          </div>
          <div className="form-grid">
            <Field label="Company / vendor name" error={errors.name}>
              <input className="input" name="name" maxLength={200} />
            </Field>
            <Field label="Registration no." optional>
              <input className="input" name="registrationNo" maxLength={100} />
            </Field>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-head">
            <h3>Login account</h3>
            <p>The vendor signs in with this username and password, and can change the password later in Settings.</p>
          </div>
          <div className="form-grid">
            <Field label="Contact name" error={errors.contactName}>
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
          {saving ? 'Creating…' : 'Create vendor'}
        </button>
      </div>
    </form>
  )
}
