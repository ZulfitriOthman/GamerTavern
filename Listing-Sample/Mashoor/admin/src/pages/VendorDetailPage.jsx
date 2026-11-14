import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { formatDate } from '@mashoor/shared/format'
import { Icon } from '@mashoor/shared/Icon'
import { Alert, ConfirmDialog, EmptyState, Field, Loading, Modal, PageHeader } from '@mashoor/shared/ui'
import { api } from '../api.js'
import { NewPasswordFields, RoleBadge, RoleSelect, UsernameInput } from './AccountFields.jsx'
import { InspectionSettings } from './InspectionSettings.jsx'
import { readNewPassword, required, usernameProblem } from './accountForm.js'
import { StatusBadge } from './StatusBadge.jsx'

export default function VendorDetailPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [allCategories, setAllCategories] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [notice, setNotice] = useState('')
  const [pageError, setPageError] = useState('')
  // Open dialog: { kind: 'add' | 'edit' | 'reset' | 'reactivate' | 'deactivate' | 'suspend', user? }
  const [dialog, setDialog] = useState(() =>
    params.get('reactivate') ? { kind: 'reactivate', userId: Number(params.get('reactivate')) } : null,
  )
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    let cancelled = false
    Promise.all([api(`/vendors/${id}`), api('/categories')]).then(
      ([vendorData, categoryData]) => {
        if (cancelled) return
        setData(vendorData)
        setAllCategories(categoryData.categories)
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

  const back = { to: '/vendors', label: 'Vendors' }
  if (loadError) {
    return (
      <>
        <PageHeader title="Vendor" back={back} />
        <div className="card">
          <EmptyState tone="error" title={loadError.status === 404 ? 'Vendor not found' : 'This vendor couldn’t load'}>
            {loadError.status === 404 ? 'It may have been removed, or the link is wrong.' : loadError.message}
          </EmptyState>
        </div>
      </>
    )
  }
  if (!data || !allCategories) {
    return (
      <>
        <PageHeader title="Vendor" back={back} />
        <div className="card">
          <Loading label="Loading vendor…" />
        </div>
      </>
    )
  }

  const { vendor, users } = data
  const suspended = vendor.status === 'suspended'
  const label = (user) => user.username ?? user.name
  const dialogUser = dialog?.userId ? users.find((u) => u.id === dialog.userId) : dialog?.user
  const showReactivate = dialog?.kind === 'reactivate' && dialogUser && !dialogUser.active

  return (
    <>
      <PageHeader
        back={back}
        title={vendor.name}
        badge={<StatusBadge active={!suspended} activeLabel="Active company" inactiveLabel="Suspended" />}
        description={
          vendor.registrationNo ? `Registration no. ${vendor.registrationNo}` : 'Company details, category access and login accounts.'
        }
        actions={
          suspended ? (
            <button type="button" className="btn" onClick={() => setDialog({ kind: 'unsuspend' })}>
              <Icon name="power" /> Reactivate company
            </button>
          ) : (
            <button type="button" className="btn btn-danger-outline" onClick={() => setDialog({ kind: 'suspend' })}>
              <Icon name="power" /> Suspend company
            </button>
          )
        }
      />

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

      <div className="split">
        <CategoryAccess
          key={data.categories.map((c) => c.id).join(',')}
          vendor={vendor}
          assigned={data.categories}
          allCategories={allCategories}
          onSaved={(message) => done(message)}
          onError={setPageError}
        />
        <VendorDetails vendor={vendor} onSaved={done} onError={setPageError} />
      </div>

      <section className="card" aria-labelledby="accounts-title">
        <div className="card-head">
          <div>
            <h2 id="accounts-title">Login accounts</h2>
            <p>
              Each account signs in with its username and shares {vendor.name}’s category access. There is no email
              recovery — reset forgotten passwords here.
            </p>
          </div>
          <button type="button" className="btn" onClick={() => setDialog({ kind: 'add' })}>
            <Icon name="plus" /> Add account
          </button>
        </div>
        {users.length === 0 ? (
          <EmptyState icon="user" title="No login accounts">
            Add an account so this vendor can sign in to the portal.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Name</th>
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
                    <td data-label="Name">
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
                          <button
                            type="button"
                            className="btn btn-sm btn-danger-outline"
                            onClick={() => setDialog({ kind: 'deactivate', user })}
                          >
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

      <InspectionSettings
        key={reloadKey}
        vendor={vendor}
        users={users}
        onSaved={(message) => done(message)}
        onError={setPageError}
      />

      <Modal
        open={dialog?.kind === 'add'}
        onClose={closeDialog}
        wide
        title="Add login account"
        description={`A new account for ${vendor.name}. It shares the company’s category access.`}
      >
        <AccountForm
          submitLabel="Add account"
          withPassword
          onCancel={closeDialog}
          onSubmit={(values) => api(`/vendors/${id}/users`, { method: 'POST', body: values })}
          onDone={(result) => done(`Account ${result.user.username} added. Share the username and password; they can sign in right away.`)}
        />
      </Modal>

      <Modal open={dialog?.kind === 'edit'} onClose={closeDialog} title="Edit login account" description="Change the contact name or username.">
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
        description={
          dialogUser &&
          `Set a new password for ${label(dialogUser)}. Their current sessions end.${dialogUser.active ? '' : ' This does not reactivate the account.'}`
        }
      >
        {dialogUser && (
          <PasswordForm
            submitLabel="Reset password"
            onCancel={closeDialog}
            onSubmit={(values) => api(`/vendor-users/${dialogUser?.id}/reset-password`, { method: 'POST', body: values })}
            onDone={() =>
              done(
                dialogUser?.active
                  ? `Password reset for ${label(dialogUser)}. They were signed out and can sign in with the new password right away.`
                  : `Password reset for ${label(dialogUser)}. The account is still deactivated — reactivate it to restore access.`,
              )
            }
          />
        )}
      </Modal>

      <Modal
        open={Boolean(showReactivate)}
        onClose={closeDialog}
        title="Reactivate login account"
        description={
          dialogUser &&
          `Set a new password for ${label(dialogUser)}. The old password stays invalid; they sign in with this one.`
        }
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
        title="Deactivate login account?"
        description={
          dialogUser &&
          `${label(dialogUser)} is signed out now and can’t sign in until reactivated with a new password. The account, username and categories are kept.`
        }
        confirmLabel="Deactivate"
        onCancel={closeDialog}
        action={() => api(`/vendor-users/${dialogUser?.id}`, { method: 'PATCH', body: { active: false } })}
        onDone={() => done(`${label(dialogUser)} deactivated and signed out. The account, username and categories are kept.`)}
      />
      <ActionConfirm
        open={dialog?.kind === 'suspend'}
        title={`Suspend ${vendor.name}?`}
        description="Every login account of this company is signed out and blocked until the company is reactivated."
        confirmLabel="Suspend company"
        onCancel={closeDialog}
        action={() => api(`/vendors/${id}`, { method: 'PATCH', body: { status: 'suspended' } })}
        onDone={() => done('Company suspended. All of its sessions were ended.')}
      />
      <ActionConfirm
        open={dialog?.kind === 'unsuspend'}
        tone="primary"
        title={`Reactivate ${vendor.name}?`}
        description="Its active login accounts can sign in again with their current passwords."
        confirmLabel="Reactivate company"
        onCancel={closeDialog}
        action={() => api(`/vendors/${id}`, { method: 'PATCH', body: { status: 'active' } })}
        onDone={() => done('Company reactivated.')}
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
    const problem = required(form.get('name'), 'Enter the company or vendor name.')
    setError(problem)
    if (problem) return
    setSaving(true)
    try {
      await api(`/vendors/${vendor.id}`, {
        method: 'PATCH',
        body: { name: form.get('name'), registrationNo: form.get('registrationNo') },
      })
      onSaved('Vendor details saved.')
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
          <h2 id="details-title">Vendor details</h2>
          <p>Shown to the vendor in the portal.</p>
        </div>
      </div>
      <form className="card-body form-stack" onSubmit={handleSubmit} noValidate key={vendor.updatedAt}>
        <Field label="Company / vendor name" error={error}>
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

function CategoryAccess({ vendor, assigned, allCategories, onSaved, onError }) {
  const initial = new Set(assigned.map((c) => c.id))
  const [selected, setSelected] = useState(initial)
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const changed = selected.size !== initial.size || [...selected].some((cid) => !initial.has(cid))
  // Inactive categories are listed only if already assigned (so they can be removed).
  const choosable = allCategories.filter((c) => c.active || initial.has(c.id))
  const term = filter.trim().toLowerCase()
  const visible = term ? choosable.filter((c) => c.name.toLowerCase().includes(term)) : choosable

  function toggle(categoryId) {
    const next = new Set(selected)
    if (next.has(categoryId)) next.delete(categoryId)
    else next.add(categoryId)
    setSelected(next)
  }

  async function save() {
    setSaving(true)
    try {
      await api(`/vendors/${vendor.id}/categories`, { method: 'PUT', body: { categoryIds: [...selected] } })
      onSaved('Category access updated. It applies to the vendor’s next page load.')
    } catch (err) {
      onError(err.message)
      setSaving(false)
    }
  }

  return (
    <section className="card" aria-labelledby="access-title">
      <div className="card-head">
        <div>
          <h2 id="access-title">Category access</h2>
          <p>{vendor.name} sees published listings in the selected categories while they are active.</p>
        </div>
        <span className="badge accent plain num">
          {selected.size} of {choosable.length} selected
        </span>
      </div>
      <div className="card-body">
        {choosable.length === 0 ? (
          <EmptyState icon="tag" title="No categories yet" actions={<Link className="btn" to="/categories?new=1">Create a category</Link>}>
            Categories decide which listings a vendor can see.
          </EmptyState>
        ) : (
          <>
            {choosable.length > 6 && (
              <div className="picker-tools">
                <div className="input-search" style={{ flex: '1 1 14rem' }}>
                  <Icon name="search" />
                  <input
                    className="input"
                    type="search"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    placeholder="Filter categories"
                    aria-label="Filter categories"
                  />
                </div>
              </div>
            )}
            <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
              <legend className="visually-hidden">Categories {vendor.name} can browse</legend>
              <div className="picker">
                {visible.map((c) => (
                  <label key={c.id} className="pick">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                    <span className="pick-text">
                      <strong>{c.name}</strong>
                      <span>
                        {c.active ? `${c.publishedCount} published listing${c.publishedCount === 1 ? '' : 's'}` : 'Inactive — hidden from vendors'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              {visible.length === 0 && <p className="muted">No categories match “{filter}”.</p>}
            </fieldset>
            {selected.size === 0 && (
              <p className="field-hint" style={{ marginTop: '1rem' }}>
                With no categories selected, this vendor sees an empty catalog.
              </p>
            )}
          </>
        )}
      </div>
      {choosable.length > 0 && (
        <div className="card-foot">
          <span className="subtle">{changed ? 'Unsaved changes' : 'No changes'}</span>
          <div className="row-actions" style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="btn" disabled={!changed || saving} onClick={() => setSelected(initial)}>
              Discard
            </button>
            <button type="button" className="btn btn-primary" disabled={!changed || saving} onClick={save}>
              {saving ? 'Saving…' : 'Save category access'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

// Name + username (+ password and confirmation when creating).
function AccountForm({ user, withPassword, submitLabel, onSubmit, onDone, onCancel }) {
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = withPassword ? readNewPassword(form) : {}
    const next = {
      name: required(form.get('name'), 'Enter the person’s name.'),
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
          <Field label="Full name" hint="Signatories re-enter this name to confirm sign-offs." error={errors.name}>
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
