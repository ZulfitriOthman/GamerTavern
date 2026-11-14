import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatDate, formatDay, formatPrice } from '@mashoor/shared/format'
import { Icon } from '@mashoor/shared/Icon'
import { Alert, EmptyState, Loading, PageHeader, Pagination } from '@mashoor/shared/ui'
import { api } from '../api.js'
import { ListingStatusBadge } from './ListingStatusBadge.jsx'
import { LISTING_STATUS_OPTIONS } from './listingStatus.js'

export function ListingThumb({ listing }) {
  if (!listing.hasImage) {
    return (
      <span className="thumb placeholder" title="No image">
        <Icon name="image" label="No image" />
      </span>
    )
  }
  return (
    <img
      className="thumb"
      src={`/api/mashoor/admin/listings/${listing.id}/image?v=${encodeURIComponent(listing.updatedAt)}`}
      alt=""
      loading="lazy"
    />
  )
}

// Table + filter toolbar. Pattern references: 21st.dev ephraimduncan/table-05
// (bordered table, status badges, row actions, "Showing x–y of z") and
// amankaushik481/chip-filter (single-select status chips).
export default function ListingsPage() {
  const [params, setParams] = useSearchParams()
  const [categories, setCategories] = useState([])
  const [result, setResult] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const query = params.toString()
  const status = params.get('status') ?? ''

  useEffect(() => {
    api('/categories').then(
      (data) => setCategories(data.categories),
      () => setCategories([]),
    )
  }, [])

  useEffect(() => {
    let cancelled = false
    api(`/listings?${query}`).then(
      (data) => {
        if (cancelled) return
        setResult(data)
        setLoadError('')
      },
      (err) => !cancelled && setLoadError(err.message),
    )
    return () => {
      cancelled = true
    }
  }, [query, reloadKey])

  function update(changes) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  function applySearch(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    update({ q: String(form.get('q') ?? '').trim(), categoryId: String(form.get('categoryId') ?? '') })
  }

  async function setListingStatus(listing, nextStatus, message) {
    setActionError('')
    setNotice('')
    try {
      await api(`/listings/${listing.id}`, { method: 'PATCH', body: { status: nextStatus } })
      setNotice(message)
      setReloadKey((k) => k + 1)
    } catch (err) {
      setActionError(err.message)
    }
  }

  const filtered = Boolean(params.get('q') || params.get('categoryId') || status)

  return (
    <>
      <PageHeader
        title="Catalog listings"
        description="Products shown to vendors. Only published listings in a vendor’s active categories are visible to them."
        actions={
          <Link className="btn btn-primary" to="/listings/new">
            <Icon name="plus" /> New listing
          </Link>
        }
      />

      {actionError && (
        <Alert tone="danger" onDismiss={() => setActionError('')}>
          {actionError}
        </Alert>
      )}
      {notice && (
        <Alert tone="success" onDismiss={() => setNotice('')}>
          {notice}
        </Alert>
      )}

      <section className="card" aria-label="Listings">
        <form className="toolbar" onSubmit={applySearch} key={query} role="search">
          <div className="field grow">
            <label className="field-label" htmlFor="listing-search">
              Search
            </label>
            <div className="input-search">
              <Icon name="search" />
              <input
                id="listing-search"
                className="input"
                name="q"
                type="search"
                defaultValue={params.get('q') ?? ''}
                placeholder="Title or description"
              />
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="listing-category">
              Category
            </label>
            <select
              id="listing-category"
              className="select"
              name="categoryId"
              defaultValue={params.get('categoryId') ?? ''}
              onChange={(event) => update({ categoryId: event.target.value })}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.active ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn">
            Search
          </button>
          {filtered && (
            <button type="button" className="btn btn-ghost" onClick={() => setParams(new URLSearchParams())}>
              Clear filters
            </button>
          )}
        </form>
        <div className="toolbar" style={{ alignItems: 'center' }}>
          <div className="chips" role="group" aria-label="Filter by status">
            {[['', 'All'], ...LISTING_STATUS_OPTIONS].map(([value, label]) => (
              <button key={value || 'all'} type="button" className="chip" aria-pressed={status === value} onClick={() => update({ status: value })}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {loadError && (
          <EmptyState
            tone="error"
            title="Listings couldn’t load"
            actions={
              <button type="button" className="btn" onClick={() => setReloadKey((k) => k + 1)}>
                Try again
              </button>
            }
          >
            {loadError}
          </EmptyState>
        )}
        {!result && !loadError && <Loading label="Loading listings…" />}
        {result?.listings.length === 0 &&
          (filtered ? (
            <EmptyState
              icon="search"
              title="No listings match"
              actions={
                <button type="button" className="btn" onClick={() => setParams(new URLSearchParams())}>
                  Clear filters
                </button>
              }
            >
              Try a different search, category or status.
            </EmptyState>
          ) : (
            <EmptyState
              icon="layers"
              title="No catalog listings yet"
              actions={
                <Link className="btn btn-primary" to="/listings/new">
                  <Icon name="plus" /> New listing
                </Link>
              }
            >
              Listings belong to one category and stay hidden from vendors until published.
            </EmptyState>
          ))}
        {result?.listings.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="table table-stack">
                <thead>
                  <tr>
                    <th scope="col">Listing</th>
                    <th scope="col">Category</th>
                    <th scope="col">Price</th>
                    <th scope="col">Status</th>
                    <th scope="col">Updated</th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.listings.map((l) => (
                    <tr key={l.id}>
                      <td data-label="Listing">
                        <div className="media-row">
                          <ListingThumb listing={l} />
                          <div className="cell-main">
                            <Link className="cell-title clamp-2" to={`/listings/${l.id}`}>
                              {l.title}
                            </Link>
                            {l.description && <span className="cell-sub clamp-1">{l.description}</span>}
                          </div>
                        </div>
                      </td>
                      <td data-label="Category">
                        {l.categoryName ? (
                          <span className="media-row" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{ overflowWrap: 'anywhere' }}>{l.categoryName}</span>
                            {!l.categoryActive && <span className="badge warning">Inactive</span>}
                          </span>
                        ) : (
                          <span className="muted">None</span>
                        )}
                      </td>
                      <td data-label="Price" className="num">
                        {formatPrice(l.priceCents, l.currency) ?? <span className="muted">—</span>}
                      </td>
                      <td data-label="Status">
                        <ListingStatusBadge status={l.status} />
                      </td>
                      <td data-label="Updated" className="num subtle" title={formatDate(l.updatedAt)} style={{ whiteSpace: 'nowrap' }}>
                        {formatDay(l.updatedAt)}
                      </td>
                      <td data-label="" className="col-actions">
                        <div className="row-actions">
                          <Link className="btn btn-sm" to={`/listings/${l.id}`}>
                            <Icon name="edit" /> Edit
                          </Link>
                          {l.status === 'published' ? (
                            <button type="button" className="btn btn-sm" onClick={() => setListingStatus(l, 'draft', `“${l.title}” unpublished — vendors can no longer see it.`)}>
                              Unpublish
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => setListingStatus(l, 'published', `“${l.title}” published.`)}
                            >
                              Publish
                            </button>
                          )}
                          {l.status !== 'archived' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost btn-icon"
                              aria-label={`Archive ${l.title}`}
                              title="Archive"
                              onClick={() => setListingStatus(l, 'archived', `“${l.title}” archived — hidden from vendors.`)}
                            >
                              <Icon name="archive" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-foot">
              <Pagination pagination={result.pagination} onPage={(page) => update({ page: String(page) })} noun="listings" />
            </div>
          </>
        )}
      </section>
    </>
  )
}
