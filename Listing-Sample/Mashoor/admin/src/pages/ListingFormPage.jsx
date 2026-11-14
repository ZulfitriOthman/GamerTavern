import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { formatDate, formatPrice, priceInputValue } from '@mashoor/shared/format'
import { Icon } from '@mashoor/shared/Icon'
import { Alert, EmptyState, Field, Loading, PageHeader } from '@mashoor/shared/ui'
import { api } from '../api.js'
import { ListingStatusBadge } from './ListingStatusBadge.jsx'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif'
const PRICE = /^\d{1,9}(\.\d{1,2})?$/

export default function ListingFormPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const location = useLocation()
  const [categories, setCategories] = useState(null)
  const [listing, setListing] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(location.state?.notice ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([api('/categories'), isNew ? Promise.resolve(null) : api(`/listings/${id}`)]).then(
      ([categoryData, listingData]) => {
        if (cancelled) return
        setCategories(categoryData.categories)
        setListing(listingData?.listing ?? null)
        setLoadError(null)
      },
      (err) => !cancelled && setLoadError(err),
    )
    return () => {
      cancelled = true
    }
  }, [id, isNew])

  const back = { to: '/listings', label: 'Catalog listings' }
  if (loadError) {
    return (
      <>
        <PageHeader title={isNew ? 'New listing' : 'Listing'} back={back} />
        <div className="card">
          <EmptyState tone="error" title={loadError.status === 404 ? 'Listing not found' : 'This listing couldn’t load'}>
            {loadError.status === 404 ? 'It may have been removed, or the link is wrong.' : loadError.message}
          </EmptyState>
        </div>
      </>
    )
  }
  if (!categories || (!isNew && !listing)) {
    return (
      <>
        <PageHeader title={isNew ? 'New listing' : 'Listing'} back={back} />
        <div className="card">
          <Loading />
        </div>
      </>
    )
  }

  // Inactive categories can't receive new listings, but an existing listing keeps showing its own.
  const choosable = categories.filter((c) => c.active || c.id === listing?.categoryId)

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') ?? '').trim()
    const categoryId = String(form.get('categoryId') ?? '')
    const price = String(form.get('price') ?? '').trim()
    const next = {}
    if (!title) next.title = 'Enter a title.'
    if (!categoryId) next.categoryId = 'Choose a category.'
    if (price && !PRICE.test(price)) next.price = 'Use a number with up to 2 decimals, e.g. 199.90.'
    setErrors(next)
    setError('')
    setNotice('')
    if (Object.keys(next).length) return

    const body = { title, description: form.get('description'), categoryId: Number(categoryId), price }
    setSaving(true)
    try {
      if (isNew) {
        const created = await api('/listings', { method: 'POST', body })
        navigate(`/listings/${created.listing.id}`, {
          replace: true,
          state: { notice: 'Listing created as unpublished. Add an image, then publish it when ready.' },
        })
      } else {
        const updated = await api(`/listings/${id}`, { method: 'PATCH', body })
        setListing(updated.listing)
        setNotice('Listing saved.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function setStatus(status, message) {
    setError('')
    setNotice('')
    try {
      const updated = await api(`/listings/${id}`, { method: 'PATCH', body: { status } })
      setListing(updated.listing)
      setNotice(message)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleImage(event) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setError('')
    setNotice('')
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image must be 5 MB or smaller.')
      input.value = ''
      return
    }
    const body = new FormData()
    body.append('image', file)
    setUploading(true)
    try {
      const updated = await api(`/listings/${id}/image`, { method: 'PUT', body })
      setListing(updated.listing)
      setNotice('Image uploaded.')
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      input.value = ''
    }
  }

  async function removeImage() {
    setError('')
    setNotice('')
    try {
      const updated = await api(`/listings/${id}/image`, { method: 'DELETE' })
      setListing(updated.listing)
      setNotice('Image removed.')
    } catch (err) {
      setError(err.message)
    }
  }

  const statusActions = !isNew && (
    <>
      {listing.status !== 'published' && (
        <button type="button" className="btn btn-primary" onClick={() => setStatus('published', 'Published — vendors assigned to this category can now see it.')}>
          <Icon name="eye" /> Publish
        </button>
      )}
      {listing.status === 'published' && (
        <button type="button" className="btn" onClick={() => setStatus('draft', 'Unpublished — vendors can no longer see it.')}>
          <Icon name="eyeOff" /> Unpublish
        </button>
      )}
      {listing.status !== 'archived' && (
        <button type="button" className="btn btn-danger-outline" onClick={() => setStatus('archived', 'Archived — hidden from vendors.')}>
          <Icon name="archive" /> Archive
        </button>
      )}
    </>
  )

  return (
    <>
      <PageHeader
        back={back}
        title={isNew ? 'New listing' : listing.title}
        badge={!isNew && <ListingStatusBadge status={listing.status} />}
        description={isNew ? 'New listings start unpublished. Vendors see them only after you publish.' : `Last updated ${formatDate(listing.updatedAt)}`}
        actions={statusActions}
      />

      {error && (
        <Alert tone="danger" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert tone="success" onDismiss={() => setNotice('')}>
          {notice}
        </Alert>
      )}
      {!isNew && listing.status === 'published' && !listing.categoryActive && (
        <Alert tone="warning">This listing is published, but its category is inactive, so no vendor can see it.</Alert>
      )}

      {choosable.length === 0 ? (
        <div className="card">
          <EmptyState icon="tag" title="No active categories" actions={<Link className="btn btn-primary" to="/categories?new=1">Create a category</Link>}>
            Every listing belongs to one category. Create or activate one first.
          </EmptyState>
        </div>
      ) : (
        <div className="split form-split">
          <section className="card" aria-labelledby="details-title">
            <div className="card-head">
              <div>
                <h2 id="details-title">Details</h2>
                <p>What vendors see on the catalog card and listing page.</p>
              </div>
            </div>
            <form className="card-body form-stack" onSubmit={handleSubmit} noValidate key={listing?.updatedAt ?? 'new'}>
              <Field label="Title" error={errors.title}>
                <input className="input" name="title" defaultValue={listing?.title ?? ''} maxLength={200} />
              </Field>
              <div className="form-grid">
                <Field label="Category" error={errors.categoryId}>
                  <select className="select" name="categoryId" defaultValue={listing?.categoryId ?? ''}>
                    <option value="" disabled>
                      Choose a category
                    </option>
                    {choosable.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.active ? '' : ' (inactive)'}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Price (RM)" optional prefix="RM" hint="Leave empty to show no price." error={errors.price}>
                  <input
                    className="input num"
                    name="price"
                    inputMode="decimal"
                    defaultValue={priceInputValue(listing?.priceCents)}
                    placeholder="0.00"
                  />
                </Field>
              </div>
              <Field label="Description" optional>
                <textarea className="textarea" name="description" defaultValue={listing?.description ?? ''} maxLength={5000} rows={7} />
              </Field>
              <div className="form-actions">
                <Link className="btn" to="/listings">
                  Cancel
                </Link>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : isNew ? 'Create listing' : 'Save changes'}
                </button>
              </div>
            </form>
          </section>

          <div style={{ display: 'grid', gap: '1.5rem', alignContent: 'start' }}>
            <section className="card" aria-labelledby="image-title">
              <div className="card-head">
                <div>
                  <h2 id="image-title">Image</h2>
                  <p>PNG, JPEG, WebP or GIF, up to 5 MB.</p>
                </div>
              </div>
              <div className="card-body image-panel">
                <div className="image-frame">
                  {!isNew && listing.hasImage ? (
                    <img
                      src={`/api/mashoor/admin/listings/${listing.id}/image?v=${encodeURIComponent(listing.updatedAt)}`}
                      alt={`Image for ${listing.title}`}
                    />
                  ) : (
                    <span className="placeholder-text">
                      <Icon name="image" />
                      {isNew ? 'Save the listing first to add an image.' : 'No image yet'}
                    </span>
                  )}
                </div>
                {!isNew && (
                  <div className="form-stack">
                    <div className="field">
                      <label className="field-label" htmlFor="listing-image">
                        {listing.hasImage ? 'Replace image' : 'Upload image'}
                      </label>
                      <input id="listing-image" className="file-input" type="file" accept={IMAGE_TYPES} onChange={handleImage} disabled={uploading} />
                    </div>
                    <div className="row-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      {uploading && <span className="subtle">Uploading…</span>}
                      {listing.hasImage && (
                        <button type="button" className="btn btn-sm btn-danger-outline" onClick={removeImage}>
                          <Icon name="trash" /> Remove image
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {!isNew && (
              <section className="card" aria-labelledby="visibility-title">
                <div className="card-head">
                  <div>
                    <h2 id="visibility-title">Visibility</h2>
                  </div>
                </div>
                <div className="card-body">
                  <dl className="dl">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <ListingStatusBadge status={listing.status} />
                      </dd>
                    </div>
                    <div>
                      <dt>Category</dt>
                      <dd>
                        {listing.categoryName ?? '—'} {listing.categoryName && !listing.categoryActive && '(inactive)'}
                      </dd>
                    </div>
                    <div>
                      <dt>Price</dt>
                      <dd className="num">{formatPrice(listing.priceCents, listing.currency) ?? 'Not shown'}</dd>
                    </div>
                    <div>
                      <dt>Published</dt>
                      <dd className="num">{listing.status === 'published' ? formatDate(listing.publishedAt) : 'Not published'}</dd>
                    </div>
                  </dl>
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  )
}
