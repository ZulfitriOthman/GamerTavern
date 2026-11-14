import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { formatDate, formatPrice } from '@mashoor/shared/format'
import { Icon } from '@mashoor/shared/Icon'
import { EmptyState, Loading } from '@mashoor/shared/ui'
import { api } from '../api.js'

export default function ListingDetailPage() {
  const { id } = useParams()
  const [listing, setListing] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api(`/listings/${id}`).then(
      (data) => {
        if (cancelled) return
        setListing(data.listing)
        setError(null)
      },
      (err) => !cancelled && setError(err),
    )
    return () => {
      cancelled = true
    }
  }, [id])

  const crumbs = (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <Link to="/">My Catalogs</Link>
        </li>
        {listing && (
          <li>
            <Link to={`/?categoryId=${listing.categoryId}`}>{listing.categoryName}</Link>
          </li>
        )}
        {listing && (
          <li aria-current="page" className="clamp-1">
            {listing.title}
          </li>
        )}
      </ol>
    </nav>
  )

  if (error) {
    return (
      <>
        {crumbs}
        <div className="card">
          {error.status === 404 ? (
            <EmptyState
              icon="layers"
              title="This listing isn’t available"
              actions={
                <Link className="btn" to="/">
                  Back to My Catalogs
                </Link>
              }
            >
              It may have been unpublished, or it isn’t shared with your company.
            </EmptyState>
          ) : (
            <EmptyState tone="error" title="This listing couldn’t load">
              {error.message}
            </EmptyState>
          )}
        </div>
      </>
    )
  }
  if (!listing) {
    return (
      <>
        {crumbs}
        <div className="card">
          <Loading label="Loading listing…" />
        </div>
      </>
    )
  }

  const price = formatPrice(listing.priceCents, listing.currency)
  return (
    <>
      {crumbs}
      <article className="detail">
        <div className="card detail-media">
          <div className="listing-media">
            {listing.hasImage ? (
              <img src={`/api/mashoor/portal/listings/${listing.id}/image?v=${encodeURIComponent(listing.updatedAt)}`} alt={listing.title} />
            ) : (
              <span className="placeholder-text">
                <Icon name="image" />
                No image provided
              </span>
            )}
          </div>
        </div>
        <div className="detail-info">
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <Link className="tag" to={`/?categoryId=${listing.categoryId}`} style={{ textDecoration: 'none', width: 'fit-content' }}>
              {listing.categoryName}
            </Link>
            <h1>{listing.title}</h1>
            {price && <p className="price detail-price">{price}</p>}
          </div>
          {listing.description ? (
            <p className="detail-description">{listing.description}</p>
          ) : (
            <p className="muted">No description provided.</p>
          )}
          <dl className="dl detail-meta">
            <div>
              <dt>Category</dt>
              <dd>{listing.categoryName}</dd>
            </div>
            <div>
              <dt>Published</dt>
              <dd className="num">{formatDate(listing.publishedAt)}</dd>
            </div>
          </dl>
          <Link className="back-link" to="/">
            <Icon name="back" /> Back to My Catalogs
          </Link>
        </div>
      </article>
    </>
  )
}
