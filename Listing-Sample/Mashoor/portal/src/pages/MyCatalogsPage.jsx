import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '@mashoor/shared/useAuth'
import { formatPrice } from '@mashoor/shared/format'
import { Icon } from '@mashoor/shared/Icon'
import { EmptyState, PageHeader, Pagination } from '@mashoor/shared/ui'
import { api } from '../api.js'

// Read-only. Everything shown comes from the API, which only ever returns
// published listings in categories assigned to this vendor's company.
// Pattern references: 21st.dev deltacomponents/product-card (full-bleed image
// well, title + subtitle + price) and amankaushik481/chip-filter (category chips).
export default function MyCatalogsPage() {
  const { session } = useAuth()
  const [params, setParams] = useSearchParams()
  const [categories, setCategories] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const query = params.toString()
  const activeCategory = params.get('categoryId') ?? ''
  const search = params.get('q') ?? ''

  useEffect(() => {
    let cancelled = false
    api('/categories').then(
      (data) => !cancelled && setCategories(data.categories),
      (err) => !cancelled && setError(err.message),
    )
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  useEffect(() => {
    let cancelled = false
    api(`/listings?${query}`).then(
      (data) => {
        if (cancelled) return
        setResult(data)
        setError('')
      },
      (err) => !cancelled && setError(err.message),
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
    update({ q: String(new FormData(event.currentTarget).get('q') ?? '').trim() })
  }

  const filtered = Boolean(search || activeCategory)
  const loading = !error && (!categories || !result)
  const header = <PageHeader title="My Catalogs" description={`Catalog listings shared with ${session.company.name}.`} />

  if (error) {
    return (
      <>
        {header}
        <div className="card">
          <EmptyState
            tone="error"
            title="Your catalog couldn’t load"
            actions={
              <button type="button" className="btn" onClick={() => setReloadKey((k) => k + 1)}>
                Try again
              </button>
            }
          >
            {error}
          </EmptyState>
        </div>
      </>
    )
  }

  if (categories?.length === 0) {
    return (
      <>
        {header}
        <div className="card">
          <EmptyState icon="layers" title="No catalogs shared with you yet">
            Listings will appear here once Mashoor shares a category with {session.company.name}. If you expected to see
            something, contact your administrator.
          </EmptyState>
        </div>
      </>
    )
  }

  return (
    <>
      {header}

      <section className="card catalog-tools" aria-label="Search and filter">
        <form className="search-row" role="search" onSubmit={applySearch} key={search}>
          <div className="input-search">
            <Icon name="search" />
            <input className="input" type="search" name="q" defaultValue={search} placeholder="Search by title or description" aria-label="Search listings" />
          </div>
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
        {categories && (
          <div className="chips" role="group" aria-label="Filter by category">
            <button type="button" className="chip" aria-pressed={!activeCategory} onClick={() => update({ categoryId: '' })}>
              All categories
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip"
                aria-pressed={activeCategory === String(c.id)}
                onClick={() => update({ categoryId: String(c.id) })}
              >
                {c.name} <span className="count">{c.listingCount}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {loading ? (
        <div className="listing-grid" aria-busy="true" aria-label="Loading listings">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="card skeleton-card" aria-hidden="true">
              <div className="skeleton media" />
              <div className="listing-body">
                <div className="skeleton" style={{ height: '0.75rem', width: '40%' }} />
                <div className="skeleton" style={{ height: '1rem', width: '85%' }} />
                <div className="skeleton" style={{ height: '1rem', width: '30%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : result.listings.length === 0 ? (
        <div className="card">
          {filtered ? (
            <EmptyState
              icon="search"
              title="No listings match"
              actions={
                <button type="button" className="btn" onClick={() => setParams(new URLSearchParams())}>
                  Clear search and filters
                </button>
              }
            >
              Try a different search term or category.
            </EmptyState>
          ) : (
            <EmptyState icon="layers" title="Nothing published yet">
              Your categories don’t have any published listings right now. Check back later.
            </EmptyState>
          )}
        </div>
      ) : (
        <>
          <div className="results-meta">
            <span className="num" role="status">
              {result.pagination.total} listing{result.pagination.total === 1 ? '' : 's'}
              {search && <> for “{search}”</>}
            </span>
            {filtered && (
              <button type="button" className="btn-link" onClick={() => setParams(new URLSearchParams())}>
                Clear filters
              </button>
            )}
          </div>
          <section className="listing-grid" aria-label="Listings">
            {result.listings.map((l) => (
              <Link key={l.id} to={`/listings/${l.id}`} className="card listing-card">
                <div className="listing-media">
                  {l.hasImage ? (
                    <img src={`/api/mashoor/portal/listings/${l.id}/image?v=${encodeURIComponent(l.updatedAt)}`} alt="" loading="lazy" />
                  ) : (
                    <span className="placeholder-text">
                      <Icon name="image" />
                      No image
                    </span>
                  )}
                </div>
                <div className="listing-body">
                  <span className="tag clamp-1">{l.categoryName}</span>
                  <span className="listing-title clamp-2">{l.title}</span>
                  {l.priceCents !== null && <span className="price">{formatPrice(l.priceCents, l.currency)}</span>}
                </div>
              </Link>
            ))}
          </section>
          <Pagination pagination={result.pagination} onPage={(page) => update({ page: String(page) })} noun="listings" />
        </>
      )}
    </>
  )
}
