import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '@mashoor/shared/Icon'
import { EmptyState, Loading, PageHeader } from '@mashoor/shared/ui'
import { api } from '../api.js'

export default function DashboardPage() {
  const [totals, setTotals] = useState(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    api('/dashboard').then(
      (data) => {
        if (cancelled) return
        setTotals(data.totals)
        setError('')
      },
      (err) => !cancelled && setError(err.message),
    )
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const header = (
    <PageHeader
      title="Dashboard"
      description="Vendors, categories and catalog listings at a glance."
      actions={
        <Link className="btn btn-primary" to="/listings/new">
          <Icon name="plus" /> New listing
        </Link>
      }
    />
  )

  if (error) {
    return (
      <>
        {header}
        <div className="card">
          <EmptyState
            tone="error"
            title="The dashboard couldn’t load"
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
  if (!totals) {
    return (
      <>
        {header}
        <div className="card">
          <Loading label="Loading totals…" />
        </div>
      </>
    )
  }

  const { vendors, vendorAccounts, categories, listings } = totals
  const steps = [
    { done: categories.total > 0, label: 'Create a category', to: '/categories?new=1' },
    { done: vendors.total > 0, label: 'Add a vendor and its login account', to: '/vendors?new=1' },
    { done: listings.total > 0, label: 'Add a catalog listing', to: '/listings/new' },
    { done: listings.published > 0, label: 'Publish a listing', to: '/listings?status=draft' },
  ]
  const setupDone = steps.every((step) => step.done)

  return (
    <>
      {header}

      <section className="metrics" aria-label="Totals">
        <Link className="card metric" to="/vendors">
          <span className="metric-label">
            <Icon name="store" /> Vendors
          </span>
          <span className="metric-value">{vendors.total}</span>
          <span className="metric-detail">{vendors.active} active</span>
        </Link>
        <Link className="card metric" to="/vendors">
          <span className="metric-label">
            <Icon name="user" /> Active vendor accounts
          </span>
          <span className="metric-value">{vendorAccounts.active}</span>
          <span className="metric-detail">of {vendorAccounts.total} login accounts</span>
        </Link>
        <Link className="card metric" to="/categories">
          <span className="metric-label">
            <Icon name="tag" /> Categories
          </span>
          <span className="metric-value">{categories.total}</span>
          <span className="metric-detail">{categories.active} active</span>
        </Link>
        <Link className="card metric" to="/listings">
          <span className="metric-label">
            <Icon name="layers" /> Catalog listings
          </span>
          <span className="metric-value">{listings.total}</span>
          <span className="metric-detail">{listings.published} published</span>
        </Link>
      </section>

      <div className="split">
        <section className="card" aria-labelledby="quick-actions">
          <div className="card-head">
            <div>
              <h2 id="quick-actions">Quick actions</h2>
              <p>Common tasks for keeping vendor catalogs up to date.</p>
            </div>
          </div>
          <div className="card-body">
            <div className="actions-grid">
              <Link className="action-tile" to="/vendors?new=1">
                <span className="action-tile-icon">
                  <Icon name="store" />
                </span>
                <span>
                  <strong>Add a vendor</strong>
                  <span>Create the company and its login account.</span>
                </span>
              </Link>
              <Link className="action-tile" to="/categories?new=1">
                <span className="action-tile-icon">
                  <Icon name="tag" />
                </span>
                <span>
                  <strong>Create a category</strong>
                  <span>Categories decide what each vendor sees.</span>
                </span>
              </Link>
              <Link className="action-tile" to="/listings/new">
                <span className="action-tile-icon">
                  <Icon name="plus" />
                </span>
                <span>
                  <strong>New catalog listing</strong>
                  <span>Add a product with image and price.</span>
                </span>
              </Link>
              <Link className="action-tile" to="/listings?status=draft">
                <span className="action-tile-icon">
                  <Icon name="eye" />
                </span>
                <span>
                  <strong>Review unpublished</strong>
                  <span className="num">
                    {listings.draft} listing{listings.draft === 1 ? '' : 's'} not visible to vendors.
                  </span>
                </span>
              </Link>
            </div>
          </div>
        </section>

        {setupDone ? (
          <section className="card" aria-labelledby="listing-status">
            <div className="card-head">
              <div>
                <h2 id="listing-status">Listings by status</h2>
                <p>Only published listings are visible to vendors.</p>
              </div>
            </div>
            <div className="card-body">
              <ul className="status-list">
                <li>
                  <Link to="/listings?status=published">
                    <span className="badge success">Published</span>
                  </Link>
                  <strong>{listings.published}</strong>
                </li>
                <li>
                  <Link to="/listings?status=draft">
                    <span className="badge">Unpublished</span>
                  </Link>
                  <strong>{listings.draft}</strong>
                </li>
                <li>
                  <Link to="/listings?status=archived">
                    <span className="badge warning">Archived</span>
                  </Link>
                  <strong>{listings.archived}</strong>
                </li>
              </ul>
            </div>
          </section>
        ) : (
          <section className="card" aria-labelledby="getting-started">
            <div className="card-head">
              <div>
                <h2 id="getting-started">Getting started</h2>
                <p>Vendors see listings once all of these are in place.</p>
              </div>
            </div>
            <div className="card-body">
              <ol className="steps">
                {steps.map((step, index) => (
                  <li key={step.label} className={step.done ? 'done' : ''}>
                    <span className="step-dot" aria-hidden="true">
                      {step.done ? <Icon name="check" /> : index + 1}
                    </span>
                    {step.done ? (
                      <span>
                        {step.label} <span className="visually-hidden">(done)</span>
                      </span>
                    ) : (
                      <Link to={step.to}>{step.label}</Link>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}
      </div>
    </>
  )
}
