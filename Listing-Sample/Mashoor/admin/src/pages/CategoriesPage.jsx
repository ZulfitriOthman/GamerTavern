import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Icon } from '@mashoor/shared/Icon'
import { Alert, ConfirmDialog, EmptyState, Field, Loading, Modal, PageHeader } from '@mashoor/shared/ui'
import { api } from '../api.js'
import { required } from './accountForm.js'
import { StatusBadge } from './StatusBadge.jsx'

export default function CategoriesPage() {
  const [params, setParams] = useSearchParams()
  const [categories, setCategories] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  // { kind: 'create' | 'edit' | 'deactivate' | 'delete', category? }
  const [dialog, setDialog] = useState(() => (params.get('new') === '1' ? { kind: 'create' } : null))
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [rowError, setRowError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    let cancelled = false
    api('/categories').then(
      (data) => {
        if (cancelled) return
        setCategories(data.categories)
        setLoadError('')
      },
      (err) => !cancelled && setLoadError(err.message),
    )
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  function open(next) {
    setDialogError('')
    setDialog(next)
  }
  function close() {
    setDialog(null)
    if (params.has('new')) setParams(new URLSearchParams(), { replace: true })
  }
  function done(message) {
    close()
    setRowError('')
    setNotice(message)
    reload()
  }

  async function runConfirm(action, message) {
    setBusy(true)
    setDialogError('')
    try {
      await action()
      done(message)
    } catch (err) {
      setDialogError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function activate(category) {
    setRowError('')
    try {
      await api(`/categories/${category.id}`, { method: 'PATCH', body: { active: true } })
      setNotice(`“${category.name}” is active again. Its published listings are visible to assigned vendors.`)
      reload()
    } catch (err) {
      setRowError(err.message)
    }
  }

  const target = dialog?.category

  return (
    <>
      <PageHeader
        title="Categories"
        description="Group catalog listings and control which vendors can see them."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => open({ kind: 'create' })}>
            <Icon name="plus" /> New category
          </button>
        }
      />

      {rowError && (
        <Alert tone="danger" onDismiss={() => setRowError('')}>
          {rowError}
        </Alert>
      )}
      {notice && (
        <Alert tone="success" onDismiss={() => setNotice('')}>
          {notice}
        </Alert>
      )}

      <section className="card" aria-label="Category list">
        {loadError && (
          <EmptyState tone="error" title="Categories couldn’t load" actions={<button type="button" className="btn" onClick={reload}>Try again</button>}>
            {loadError}
          </EmptyState>
        )}
        {!categories && !loadError && <Loading label="Loading categories…" />}
        {categories?.length === 0 && (
          <EmptyState
            icon="tag"
            title="No categories yet"
            actions={
              <button type="button" className="btn btn-primary" onClick={() => open({ kind: 'create' })}>
                <Icon name="plus" /> New category
              </button>
            }
          >
            Every listing belongs to one category, and vendors see the categories assigned to them.
          </EmptyState>
        )}
        {categories?.length > 0 && (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Status</th>
                  <th scope="col">Listings</th>
                  <th scope="col">Vendors</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Category">
                      <div className="cell-main">
                        <span className="cell-title">{c.name}</span>
                        {c.description && <span className="cell-sub clamp-2">{c.description}</span>}
                      </div>
                    </td>
                    <td data-label="Status">
                      <StatusBadge active={c.active} inactiveTone="" />
                    </td>
                    <td data-label="Listings" className="num">
                      <Link to={`/listings?categoryId=${c.id}`} style={{ whiteSpace: 'nowrap' }}>
                        {c.publishedCount} published / {c.listingCount}
                      </Link>
                    </td>
                    <td data-label="Vendors" className="num">
                      {c.vendorCount}
                    </td>
                    <td data-label="" className="col-actions">
                      <div className="row-actions">
                        <button type="button" className="btn btn-sm" onClick={() => open({ kind: 'edit', category: c })}>
                          <Icon name="edit" /> Edit
                        </button>
                        {c.active ? (
                          <button type="button" className="btn btn-sm" onClick={() => open({ kind: 'deactivate', category: c })}>
                            Deactivate
                          </button>
                        ) : (
                          <button type="button" className="btn btn-sm" onClick={() => activate(c)}>
                            Activate
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost btn-icon"
                          onClick={() => open({ kind: 'delete', category: c })}
                          aria-label={`Delete ${c.name}`}
                          title="Delete"
                        >
                          <Icon name="trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={dialog?.kind === 'create'} onClose={close} title="New category" description="Names must be unique (case and spacing are ignored).">
        <CategoryForm
          submitLabel="Create category"
          onCancel={close}
          onSubmit={(values) => api('/categories', { method: 'POST', body: values })}
          onDone={(result) => done(`Category “${result.category.name}” created. Assign it to vendors on their pages.`)}
        />
      </Modal>
      <Modal open={dialog?.kind === 'edit'} onClose={close} title="Edit category">
        {target && (
          <CategoryForm
            category={target}
            submitLabel="Save changes"
            onCancel={close}
            onSubmit={(values) => api(`/categories/${target?.id}`, { method: 'PATCH', body: values })}
            onDone={() => done('Category saved.')}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={dialog?.kind === 'deactivate'}
        title={target ? `Deactivate “${target.name}”?` : ''}
        description="Its listings are hidden from every vendor until the category is activated again. Nothing is deleted."
        confirmLabel="Deactivate"
        busy={busy}
        error={dialogError}
        onCancel={close}
        onConfirm={() =>
          runConfirm(
            () => api(`/categories/${target?.id}`, { method: 'PATCH', body: { active: false } }),
            `“${target?.name}” deactivated — its listings are hidden from every vendor.`,
          )
        }
      />
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        title={target ? `Delete “${target.name}”?` : ''}
        description="This can’t be undone. Categories still used by listings or vendors can’t be deleted — deactivate them instead."
        confirmLabel="Delete category"
        busy={busy}
        error={dialogError}
        onCancel={close}
        onConfirm={() => runConfirm(() => api(`/categories/${target?.id}`, { method: 'DELETE' }), `Category “${target?.name}” deleted.`)}
      />
    </>
  )
}

function CategoryForm({ category, submitLabel, onSubmit, onDone, onCancel }) {
  const [error, setError] = useState('')
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const problem = required(form.get('name'), 'Enter a category name.')
    setError(problem)
    setServerError('')
    if (problem) return
    setSaving(true)
    try {
      const result = await onSubmit({ name: form.get('name'), description: form.get('description') })
      onDone(result)
    } catch (err) {
      if (err.status === 409) setError(err.message)
      else setServerError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="dialog-body">
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        <Field label="Name" error={error}>
          <input className="input" name="name" defaultValue={category?.name ?? ''} maxLength={100} />
        </Field>
        <Field label="Description" optional>
          <textarea className="textarea" name="description" defaultValue={category?.description ?? ''} maxLength={1000} rows={3} />
        </Field>
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
