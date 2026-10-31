# Marketplace Integration Test Plan (Phase 1.5)

No safe development MySQL database was available in this session (per `NanashiCollectibles/CLAUDE.md` §61 — a reachable backend must never be assumed to use a disposable local database, and `Backend/.env.dev` is explicitly flagged as possibly pointing at an externally hosted database). Everything in this Phase 1.5 pass was verified by `node --check` (syntax only) and manual logic review, **not** by running requests against a real server/database. This document is the checklist to run once you have a confirmed dev/test MySQL instance.

## 0. Setup

1. Confirm the target MySQL instance is a disposable dev/test database — **do not run this against `.env.dev` if it points anywhere you're not certain is a throwaway.**
2. Run in order (paths updated 2026-09-14 — the old `NanashiCollectibles_v2.sql` /
   `Marketplace_Migration*.sql` files no longer exist; their content was merged
   into `Database/schema/` and `Database/All.sql` during the database cleanup —
   see `Database/README.md`):
   - `Database/All.sql` (fresh-install script — creates all 49 current tables; equivalent to running `Database/schema/001_core_auth.sql` through `008_platform_ops.sql` in order, which is already the state a fresh-install `All.sql` produces, so no separate hardening migration step is needed for a NEW database)
   - Optionally `Database/seeds/reference.sql` then `Database/seeds/development.sql` (replace the placeholder password hashes with real bcrypt hashes first, or just register through the API instead of running the seed's user inserts)
   - For an EXISTING database instead of a fresh one, run `Database/migrations/0001_add_checkout_idempotency_and_bank_encryption.sql` instead of `All.sql`
3. Set `Backend/.env.dev` (or an isolated `DOTENV_FILE`): `MYSQL_*`, `JWT_SECRET`, `PAYMENT_PROVIDER=mock`, `MARKETPLACE_DATA_ENCRYPTION_KEY` (generate via the command in `env.example`).
4. `cd Backend && npm install && npm run dev` — confirm `[DB] connected: YES` in the startup log.

## 1. SQL verification checklist (run these manually, read-only)

```sql
-- Every new table exists
SHOW TABLES LIKE 'merchant%';
SHOW TABLES LIKE '%order%';
SHOW TABLES LIKE 'checkout_idempotency';

-- FK integrity — should return 0 rows each
SELECT * FROM products WHERE merchant_id IS NOT NULL AND merchant_id NOT IN (SELECT id FROM merchants);
SELECT * FROM merchant_orders WHERE merchant_id NOT IN (SELECT id FROM merchants);
SELECT * FROM order_items oi WHERE oi.order_id NOT IN (SELECT id FROM orders);

-- Column types (spot-check DECIMAL usage)
SHOW COLUMNS FROM orders LIKE '%total%';
SHOW COLUMNS FROM merchant_orders LIKE '%amount%';
SHOW COLUMNS FROM merchant_bank_details;

-- Unique constraints present
SHOW INDEX FROM checkout_idempotency WHERE Key_name = 'uq_checkout_idempotency_user_key';
SHOW INDEX FROM orders WHERE Key_name = 'uq_orders_order_number';
```

## 2. Customer flow

| # | Test | Expected |
|---|------|----------|
| 1 | `POST /api/auth/register` + `POST /api/auth/login` | 201/200, JWT returned |
| 2 | `POST /api/cart/items` (no auth, guest token) | 201, item added, cart persists across requests using the returned `guestToken` header |
| 3 | `PATCH /api/cart/items/:id` quantity → 0 | Item removed |
| 4 | `GET /api/shipping/methods` | Returns Pickup/Local Delivery (if seeded) |
| 5 | `POST /api/checkout` with valid `Idempotency-Key`, `paymentToken` from `POST /api/payments/mock/tokenize` (card ending `4242`) | 201, order `PAID`/`PROCESSING`, stock deducted, cart marked `converted` |
| 6 | Repeat #5 with the **same** `Idempotency-Key` and same body | Same response replayed, **no second order, no second stock deduction** — verify via `SELECT COUNT(*) FROM orders` before/after |
| 7 | Repeat #5 with the **same key**, different `shippingMethodId` | `409 IDEMPOTENCY_KEY_REUSED` |
| 8 | Checkout with a card/token ending `0002`/`0069`/`0119` | `402 PAYMENT_FAILED`, order `CANCELLED`, stock restored — verify `stock_quantity` back to pre-checkout value and an `inventory_movements` row with `reason='cancelled_order'` |
| 9 | Checkout with quantity greater than stock | `409 INSUFFICIENT_STOCK` |
| 10 | `GET /api/orders` / `GET /api/orders/:id` | Own orders only |
| 11 | **Cross-user**: `GET /api/orders/:id` for another user's order (as User A, using User B's order id) | `404`, not `403`, and no order fields present in the body |
| 12 | `POST /api/wishlist/items`, `GET /api/wishlist`, `DELETE /api/wishlist/items/:productId` | Works end to end |
| 13 | `POST /api/reviews` after a `PAID` order containing that product | `verifiedPurchase: true` in the response |

## 3. Concurrency (the two tests that matter most)

| # | Test | Expected |
|---|------|----------|
| 14 | Two parallel `POST /api/checkout` requests, **different** idempotency keys, same account, for a product with `stock_quantity = 1`, both requesting qty 1 | Exactly one succeeds (`201`), the other gets `409 INSUFFICIENT_STOCK` — never both succeeding, never negative stock |
| 15 | Two parallel `POST /api/checkout` requests, **same** idempotency key, same body (simulating a double-click) | Exactly one actually reserves/charges; the other gets either the replayed result or `409 CHECKOUT_IN_PROGRESS` — verify only one row in `orders` for this attempt |

## 4. Reconciliation

| # | Test | Expected |
|---|------|----------|
| 16 | Manually `INSERT` (or let a killed `npm run dev` process leave) an `orders` row with `status='PENDING_PAYMENT'`, `payment_status='PENDING'`, `created_at` older than the threshold, plus its `order_items`/deducted stock, and **no** `payment_transactions` row | `GET /api/admin/reconciliation/stale` (as an `ADMIN` user) lists it |
| 17 | `POST /api/admin/reconciliation/run` with `dryRun:true` | Reports `WOULD_CANCEL`, changes nothing (verify stock unchanged) |
| 18 | `POST /api/admin/reconciliation/run` with `dryRun:false` | Order → `CANCELLED`, stock restored, `order_status_history` and `audit_logs` rows written |

## 5. Merchant flow

| # | Test | Expected |
|---|------|----------|
| 19 | `POST /api/merchant/register` | 201, merchant `status: PENDING` |
| 20 | Try `product:create` (Socket.IO) as that new merchant's user before an admin activates the merchant | `403 MERCHANT_NOT_ACTIVE` |
| 21 | Manually `UPDATE merchants SET status='ACTIVE' WHERE id=?`, then retry `product:create` | Succeeds, `products.merchant_id` set correctly |
| 22 | `product:update` / `product:archive` / `inventory:adjust` as the same user | Succeeds (owner) |
| 23 | `POST /api/merchant/staff` to add a second user as `MERCHANT_EMPLOYEE`, then have **that** user call `product:update` on a product created by the owner | Succeeds (same-merchant staff, not just the original creator) — this exercises the Phase 1.5 ownership fix in `product.controller.js` |
| 24 | `GET /api/merchant/dashboard`, `/products`, `/orders` | Real aggregated numbers, paginated `{items, pagination}` shape |
| 25 | `PATCH /api/merchant/orders/:id/status` through an invalid transition (e.g. `PROCESSING` → `DELIVERED` directly) | `400 INVALID_TRANSITION` |
| 26 | `POST /api/merchant/settings/bank-details` without `MARKETPLACE_DATA_ENCRYPTION_KEY` set | `503 ENCRYPTION_NOT_CONFIGURED` |
| 27 | Same, with the key set | `201`, `GET /api/merchant/settings` shows only `****last4`, never the raw number |
| 28 | Bank-details write as `MERCHANT_ADMIN` (not `OWNER`) | `403 INSUFFICIENT_ROLE` |

## 6. Security / IDOR

| # | Test | Expected |
|---|------|----------|
| 29 | Merchant A's JWT calling `GET /api/merchant/orders/:id` with Merchant B's `merchant_order` id | `404`, no data leaked |
| 30 | Merchant A's JWT calling `GET /api/merchant/products` | Only Merchant A's products, never Merchant B's |
| 31 | Suspended merchant (`merchant_users.status='suspended'` for that user) calling any `/api/merchant/*` route | `403 MEMBERSHIP_SUSPENDED` |
| 32 | Unauthenticated request to any `/api/merchant/*` route except `/register`, `/auth/login` | `401 AUTH_REQUIRED` |
| 33 | Attempt `POST /api/checkout` with a `grandTotal`/`amount` field injected into the body | Ignored entirely — confirm the charged amount in `payment_transactions.amount` matches the server-computed total, not anything sent by the client (the route doesn't even read such a field, but verify no regression) |
| 34 | Attempt product update with someone else's `merchant_id` injected into the payload | Ignored — `product.controller.js` never reads a client-supplied `merchantId` for this |
| 35 | `POST /api/payments/mock/tokenize` with `PAYMENT_PROVIDER=cybersource` | `400 MOCK_TOKENIZE_DISABLED` |

## 7. What "done" looks like

All of the above pass, plus: no test above ever required editing a route file to work around unexpected behavior (any such edit means a bug survived this review and should be reported, not silently patched).
