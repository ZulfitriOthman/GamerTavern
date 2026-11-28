// One client organisation: details, portal accounts (role, reset, deactivate,
// reactivate), suspension, and the inspection sign-off stages with the
// acknowledgement-blocking option. Derived from the existing admin
// VendorDetailPage without the catalog (category access) card; the sign-off
// card is the existing InspectionSettings component.
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { formatDate } from '@mashoor/shared/format'
import { Icon } from '@mashoor/shared/Icon'
import { Alert, ConfirmDialog, EmptyState, Field, Loading, Modal, PageHeader } from '@mashoor/shared/ui'
import { NewPasswordFields, RoleBadge, RoleSelect, UsernameInput } from '@legacy-admin/pages/AccountFields.jsx'
import { InspectionSettings } from '@legacy-admin/pages/InspectionSettings.jsx'
import { readNewPassword, required, usernameProblem } from '@legacy-admin/pages/accountForm.js'
import { StatusBadge } from '@legacy-admin/pages/StatusBadge.jsx'
import { api } from '../api.js'

export default function VendorPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [notice, setNotice] = useState('')
  const [pageError, setPageError] = useState('')
  // Open dialog: { kind: 'add' | 'edit' | 'reset' | 'reactivate' | 'deactivate' | 'suspend' | 'unsuspend', user? }
  const [dialog, setDialog] = useState(() => (params.get('reactivate') ? { kind: 'reactivate', userId: Number(params.get('reactivate')) } : null))
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)
  const onError = useCallback((message) => setPageError(message), [])

  useEffect(() => {
    let cancelled = false
    api(`/vendors/${id}`).then(
      (d) => {
        if (cancelled) return
        setData(d)
        setLoadError(null)
      },
      (err) => !cancelled && setLoadError(err),
    )
    return () => {
      cancelled = true
    }
  }, [id, reloadKey])

  function closeDialog() {
    setDialog(null)
    if (params.has('reactivate')) setParams(new URLSearchParams(), { replace: true })
  }

  function done(message) {
    closeDialog()
    setPageError('')
    setNotice(message)
    reload()
  }

  const back = { to: '/vendors', label: 'Vendors (organisations)' }
  if (loadError) {
    return (
      <>
        <PageHeader title="Organisation" back={back} />
        <div className="card">
          <EmptyState tone="error" title={loadError.status === 404 ? 'Organisation not found' : 'This organisation couldn’t load'}>
            {loadError.status === 404 ? 'The link may be wrong.' : loadError.message}
          </EmptyState>
        </div>
      </>
    )
  }
  if (!data) {
    return (
      <>
        <PageHeader title="Organisation" back={back} />
        <div className="card">
          <Loading label="Loading organisation…" />
        </div>
      </>
    )
  }

  const { vendor, users } = data
  const suspended = vendor.status === 'suspended'
  const removed = vendor.status === 'removed'
  const label = (user) => user.username ?? user.name
  const dialogUser = dialog?.userId ? users.find((u) => u.id === dialog.userId) : dialog?.user
  const showReactivate = dialog?.kind === 'reactivate' && dialogUser && !dialogUser.active

  return (
    <>
      <PageHeader
        back={back}
        title={vendor.name}
        badge={<StatusBadge active={!suspended && !removed} activeLabel="Active" inactiveLabel={removed ? 'Removed' : 'Suspended'} />}
        description={vendor.registrationNo ? `Registration no. ${vendor.registrationNo}` : 'Organisation details, portal accounts and sign-off stages.'}
        actions={
          <>
            <Link className="btn" to={`/inspections?companyId=${vendor.id}`}>
              <Icon name="check" /> Inspections
            </Link>
            {removed ? null : suspended ? (
              <button type="button" className="btn" onClick={() => setDialog({ kind: 'unsuspend' })}>
                <Icon name="power" /> Reactivate organisation
              </button>
            ) : (
              <button type="button" className="btn btn-danger-outline" onClick={() => setDialog({ kind: 'suspend' })}>
                <Icon name="power" /> Suspend organisation
              </button>
            )}
          </>
        }
      />

      {removed && (
        <Alert tone="warning" title="This organisation has been removed">
          Removed {vendor.removedAt ? `on ${new Date(`${vendor.removedAt.replace(' ', 'T')}Z`).toLocaleString()}` : ''}
          {vendor.removedBy?.name ? ` by ${vendor.removedBy.name}` : ''}. Its portal accounts can’t sign in, and it can no longer be changed. Its
          inspections and history are kept for reference.
        </Alert>
      )}

      {pageError && (
        <Alert tone="danger" onDismiss={() => setPageError('')}>
          {pageError}
        </Alert>
      )}
      {notice && (
        <Alert tone="success" onDismiss={() => setNotice('')}>
          {notice}
        </Alert>
      )}

      <section className="card" aria-labelledby="accounts-title">
        <div className="card-head">
          <div>
            <h2 id="accounts-title">Portal accounts</h2>
            <p>
              Each account signs in to the portal with its username. <strong>Inspector</strong> accounts fill in checklists assigned to them;{' '}
              <strong>Vendor / Client</strong> accounts verify submitted inspections. Any account can also hold a sign-off stage (below).
            </p>
          </div>
          <button type="button" className="btn" onClick={() => setDialog({ kind: 'add' })}>
            <Icon name="plus" /> Add account
          </button>
        </div>
        {users.length === 0 ? (
          <EmptyState icon="user" title="No portal accounts">
            Add an account so this organisation can sign in to the portal.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Full name</th>
                  <th scope="col">Username</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last sign-in</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td data-label="Full name">
                      <span className="cell-title">{user.name}</span>
                    </td>
                    <td data-label="Username">
                      {user.username ? (
                        <span style={{ overflowWrap: 'anywhere' }}>{user.username}</span>
                      ) : (
                        <span className="badge warning" title="Created before usernames existed — set one with Edit">
                          No username
                        </span>
                      )}
                    </td>
                    <td data-label="Role">
                      <RoleBadge role={user.role} />
                    </td>
                    <td data-label="Status">
                      <StatusBadge active={user.active} inactiveLabel="Deactivated" />
                    </td>
                    <td data-label="Last sign-in" className="num">
                      {formatDate(user.lastLoginAt, 'Never')}
                    </td>
                    <td data-label="" className="col-actions">
                      <div className="row-actions">
                        <button type="button" className="btn btn-sm" onClick={() => setDialog({ kind: 'edit', user })}>
                          <Icon name="edit" /> Edit
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => setDialog({ kind: 'reset', user })}>
                          <Icon name="key" /> Reset password
                        </button>
                        {user.active ? (
                          <button type="button" className="btn btn-sm btn-danger-outline" onClick={() => setDialog({ kind: 'deactivate', user })}>
                            Deactivate
                          </button>
                        ) : (
                          <button type="button" className="btn btn-sm btn-primary" onClick={() => setDialog({ kind: 'reactivate', user })}>
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="split">
        <InspectionSettings key={reloadKey} vendor={vendor} users={users} onSaved={(message) => done(message)} onError={onError} />
        <VendorDetails vendor={vendor} onSaved={done} onError={setPageError} />
      </div>

      <Modal open={dialog?.kind === 'add'} onClose={closeDialog} wide title="Add portal account" description={`A new portal account for ${vendor.name}.`}>
        <AccountForm
          submitLabel="Add account"
          withPassword
          onCancel={closeDialog}
          onSubmit={(values) => api(`/vendors/${id}/users`, { method: 'POST', body: values })}
          onDone={(result) => done(`Account ${result.user.username} added. Share the username and password; they can sign in right away.`)}
        />
      </Modal>

      <Modal open={dialog?.kind === 'edit'} onClose={closeDialog} title="Edit portal account" description="Change the full name, username or role.">
        {dialogUser && (
          <AccountForm
            user={dialogUser}
            submitLabel="Save changes"
            onCancel={closeDialog}
            onSubmit={(values) => api(`/vendor-users/${dialogUser?.id}`, { method: 'PATCH', body: values })}
            onDone={() => done('Account details saved.')}
          />
        )}
      </Modal>

      <Modal
        open={dialog?.kind === 'reset'}
        onClose={closeDialog}
        title="Reset password"
        description={dialogUser && `Set a new password for ${label(dialogUser)}. Their current sessions end.${dialogUser.active ? '' : ' This does not reactivate the account.'}`}
      >
        {dialogUser && (
          <PasswordForm
            submitLabel="Reset password"
            onCancel={closeDialog}
            onSubmit={(values) => api(`/vendor-users/${dialogUser?.id}/reset-password`, { method: 'POST', body: values })}
            onDone={() => done(`Password reset for ${label(dialogUser)}.`)}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(showReactivate)}
        onClose={closeDialog}
        title="Reactivate portal account"
        description={dialogUser && `Set a new password for ${label(dialogUser)}. The old password stays invalid.`}
      >
        {showReactivate && (
          <PasswordForm
            submitLabel="Reactivate account"
            onCancel={closeDialog}
            onSubmit={(values) => api(`/vendor-users/${dialogUser?.id}/reactivate`, { method: 'POST', body: values })}
            onDone={() => done(`${label(dialogUser)} reactivated. They can sign in with the new password right away.`)}
          />
        )}
      </Modal>

      <ActionConfirm
        open={dialog?.kind === 'deactivate'}
        title="Deactivate portal account?"
        description={dialogUser && `${label(dialogUser)} is signed out now and can’t sign in until reactivated with a new password. Their records are kept.`}
        confirmLabel="Deactivate"
        onCancel={closeDialog}
        action={() => api(`/vendor-users/${dialogUser?.id}`, { method: 'PATCH', body: { active: false } })}
        onDone={() => done(`${label(dialogUser)} deactivated and signed out.`)}
      />
      <ActionConfirm
        open={dialog?.kind === 'suspend'}
        title={`Suspend ${vendor.name}?`}
        description="Every portal account of this organisation is signed out and blocked until it is reactivated."
        confirmLabel="Suspend organisation"
        onCancel={closeDialog}
        action={() => api(`/vendors/${id}`, { method: 'PATCH', body: { status: 'suspended' } })}
        onDone={() => done('Organisation suspended. All of its sessions were ended.')}
      />
      <ActionConfirm
        open={dialog?.kind === 'unsuspend'}
        tone="primary"
        title={`Reactivate ${vendor.name}?`}
        description="Its active portal accounts can sign in again with their current passwords."
        confirmLabel="Reactivate organisation"
        onCancel={closeDialog}
        action={() => api(`/vendors/${id}`, { method: 'PATCH', body: { status: 'active' } })}
        onDone={() => done('Organisation reactivated.')}
      />
    </>
  )
}

function ActionConfirm({ action, onDone, ...props }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function confirm() {
    setBusy(true)
    setError('')
    try {
      await action()
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return <ConfirmDialog {...props} busy={busy} error={error} onConfirm={confirm} onCancel={props.onCancel} />
}

function VendorDetails({ vendor, onSaved, onError }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const problem = required(form.get('name'), 'Enter the organisation name.')
    setError(problem)
    if (problem) return
    setSaving(true)
    try {
      await api(`/vendors/${vendor.id}`, { method: 'PATCH', body: { name: form.get('name'), registrationNo: form.get('registrationNo') } })
      onSaved('Organisation details saved.')
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card" aria-labelledby="details-title">
      <div className="card-head">
        <div>
          <h2 id="details-title">Organisation details</h2>
          <p>Shown to the organisation’s accounts in the portal.</p>
        </div>
      </div>
      <form className="card-body form-stack" onSubmit={handleSubmit} noValidate key={vendor.updatedAt}>
        <Field label="Organisation name" error={error}>
          <input className="input" name="name" defaultValue={vendor.name} maxLength={200} />
        </Field>
        <Field label="Registration no." optional>
          <input className="input" name="registrationNo" defaultValue={vendor.registrationNo ?? ''} maxLength={100} />
        </Field>
        <div className="form-actions start">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save details'}
          </button>
        </div>
      </form>
    </section>
  )
}

// Full name + username + role (+ password and confirmation when creating).
function AccountForm({ user, withPassword, submitLabel, onSubmit, onDone, onCancel }) {
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = withPassword ? readNewPassword(form) : {}
    const next = {
      name: required(form.get('name'), 'Enter the person’s full name.'),
      username: usernameProblem(form.get('username')),
      ...(password.errors ?? {}),
    }
    Object.keys(next).forEach((key) => !next[key] && delete next[key])
    setErrors(next)
    setServerError('')
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const result = await onSubmit({
        name: form.get('name'),
        username: form.get('username'),
        role: form.get('role'),
        ...(withPassword ? { password: password.password, confirmPassword: password.confirmPassword } : {}),
      })
      onDone(result)
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
        <div className="form-grid">
          <Field label="Full name" hint="Signatories type exactly this name to confirm a sign-off." error={errors.name}>
            <input className="input" name="name" defaultValue={user?.name ?? ''} maxLength={200} />
          </Field>
          <UsernameInput defaultValue={user?.username ?? ''} error={errors.username} />
          <RoleSelect defaultValue={user?.role ?? 'client'} />
          {withPassword && <NewPasswordFields label="Password" error={errors} />}
        </div>
      </div>
      <div className="dialog-foot">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function PasswordForm({ submitLabel, onSubmit, onDone, onCancel }) {
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const password = readNewPassword(new FormData(event.currentTarget))
    setErrors(password.errors ?? {})
    setServerError('')
    if (password.errors) return
    setSaving(true)
    try {
      await onSubmit({ password: password.password, confirmPassword: password.confirmPassword })
      onDone()
    } catch (err) {
      setServerError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="dialog-body">
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        <NewPasswordFields label="New password" error={errors} />
      </div>
      <div className="dialog-foot">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
