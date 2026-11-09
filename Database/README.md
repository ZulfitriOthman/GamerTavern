# GamerTavern / NanashiCollectibles Database

This is the single source of truth for the current GamerTavern database schema. If the schema here and the live database ever disagree, the live database is authoritative for *current state*, but this folder is authoritative for *intended* schema — see "Schema drift" below.

## ⚠️ Important: this database is shared

The live database (`nanashi_barber82street`, on shared cPanel hosting) contains **153+ tables**, of which only **62 belong to GamerTavern**. The rest are two completely unrelated applications sharing the same MySQL instance:

- A WordPress + WooCommerce install (all tables prefixed `rvs_tables`)
- A barbershop booking application (`ADMIN_USER`, `BOOKING`, `BARBER`, `PARTICIPANTS`, etc.)

**Nothing in this folder, and no migration derived from it, should ever touch those tables.** If you're writing a new migration, scope every statement to a GamerTavern table explicitly — never `DROP DATABASE`, never a wildcard operation across "all tables."

## Supported engine

MySQL 5.7+ / MariaDB 10.3+ (verified against MariaDB 10.6.28 in production). `utf8mb4` / `utf8mb4_unicode_ci` throughout — chosen over newer collations (e.g. `utf8mb4_0900_ai_ci`) for broad compatibility across MySQL 5.7, MySQL 8, and MariaDB 10.x. No `CHECK` constraints anywhere: MySQL versions before 8.0.16 silently ignore them, which would be a false sense of safety on an unconfirmed engine version — every rule that would have been a `CHECK` is enforced in backend application code instead (called out in a comment near the relevant table).

## Folder structure

```
Database/
├── README.md                 — this file
├── All.sql                   — fresh-install script (schema/001-011 concatenated, in order)
├── schema/                   — the current schema, split by domain, numbered in dependency order
│   ├── 001_core_auth.sql
│   ├── 002_reference_data.sql
│   ├── 003_catalog.sql
│   ├── 004_merchants.sql
│   ├── 005_orders_checkout.sql
│   ├── 006_payments.sql
│   ├── 007_content_community.sql
│   ├── 008_platform_ops.sql
│   ├── 009_ticketing.sql
│   ├── 010_merchant_payments.sql
│   └── 011_notifications.sql
├── migrations/                — forward changes applied to an EXISTING database, in order
│   ├── 0001_add_checkout_idempotency_and_bank_encryption.sql
│   ├── 0002_add_ticketing.sql
│   ├── 0003_reconcile_ticket_hold_sessions.sql
│   ├── 0004_add_merchant_payment_methods.sql
│   ├── 0005_add_whatsapp_notifications.sql
│   ├── 0006_add_fulfilment_and_offline_payment_methods.sql
│   ├── …
│   └── 0010_add_phone_tournament_checkins.sql
├── seeds/
│   ├── reference.sql          — safe, production-appropriate lookup data
│   └── development.sql        — fake merchants/users/products, DEV ONLY, never run against production
├── archive/                   — superseded pre-v2 schema, kept for historical reference only
│   ├── README.md
│   ├── All.sql
│   ├── All.dbml
│   └── All.dbdiagram
└── backups/                   — gitignored; timestamped dumps taken before any risky change
```

## How to create a clean database

```sql
CREATE DATABASE your_gamertavern_schema CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE your_gamertavern_schema;
SOURCE Database/All.sql;
-- optional, safe for any environment:
SOURCE Database/seeds/reference.sql;
-- optional, DEVELOPMENT DATABASES ONLY — never run against production:
SOURCE Database/seeds/development.sql;
```

`All.sql` alone creates all 68 current tables with no data. You never need to run anything from `archive/` or an individual `schema/*.sql` file separately — `All.sql` already contains everything, in the correct dependency order.

## How to apply migrations

Migrations in `migrations/` are changes to an **existing** database that already has an older version of the schema — they are not needed for a fresh install (`All.sql` already reflects every migration's end state). Run them in filename order, once, against the target database:

```sql
USE your_gamertavern_schema;
SOURCE Database/migrations/0001_add_checkout_idempotency_and_bank_encryption.sql;
SOURCE Database/migrations/0002_add_ticketing.sql;
SOURCE Database/migrations/0003_reconcile_ticket_hold_sessions.sql;
SOURCE Database/migrations/0004_add_merchant_payment_methods.sql;
SOURCE Database/migrations/0005_add_whatsapp_notifications.sql;
SOURCE Database/migrations/0006_add_fulfilment_and_offline_payment_methods.sql;
-- … 0007 through 0009 …
SOURCE Database/migrations/0010_add_phone_tournament_checkins.sql;
```

Each migration file documents what it changes and why in its own header. As of this writing, `0001` and `0002` have already been applied to the live database (2026-09-14 and 2026-09-15 respectively) — they're kept in this folder as a record and for any other environment (e.g. a second developer's local database) that still needs them. `0002` was applied live from an earlier pre-hold-session iteration of the ticketing schema; `0003` (applied 2026-09-15, live-verified, 0 rows affected) reconciled `TICKET_HOLDS`/`TICKET_ORDERS` with the current hold-session design — see "Ticketing" below. `0004` (Merchant Payments Stage 1, 2026-09-16) is additive-only (new nullable columns + new tables) and has been applied to and verified against the live database — see "Merchant Payments" below for status. `0005` (WhatsApp Merchant Notifications, 2026-09-16), also additive-only, has NOT yet been applied to any live database as of this writing — see "WhatsApp Merchant Notifications" below.

**Before running a migration that contains `DROP` / `DELETE` / `ALTER ... DROP` / `TRUNCATE`:** take a backup first (see below). Purely additive migrations (new table, new nullable column) don't strictly require one, but it's cheap insurance.

## How to create development seed data

```sql
USE your_gamertavern_schema;
SOURCE Database/seeds/development.sql;
```

This creates two example merchants (`merchant-a@example.test`, `merchant-b@example.test`) with sample products, for exercising the marketplace flows locally. **Never run this against production** — it's clearly marked at the top of the file. Their `password_hash` values are placeholder strings, not real bcrypt hashes; either replace them or register through the real app flow instead.

## How to back up the database

There's no `mysqldump` dependency baked into this project. For a full backup, use `mysqldump` if you have shell access to the host:

```bash
mysqldump -h <host> -u <user> -p <database> users password_reset_tokens countries product_categories product_types tcg_games esports_games news_categories products product_images product_options product_option_values product_variants product_variant_option_values inventory_movements deck_lists tournaments tournament_registrations tournament_teams tournament_team_members trade_listings news services enquiries merchants merchant_users merchant_addresses merchant_bank_details merchant_payment_methods merchant_payment_accounts merchant_order_payments merchant_commission_statements merchant_commission_statement_items merchant_commission_payments customer_addresses order_delivery_attachments carts cart_items wishlists wishlist_items shipping_methods merchant_fulfilment_methods orders merchant_orders order_items order_status_history shipments checkout_idempotency payment_transactions refunds coupons coupon_usage reviews merchant_payouts merchant_payout_items platform_settings notifications audit_logs \
  > Database/backups/database_before_cleanup_$(date +%Y%m%d).sql
```

**List the GamerTavern tables explicitly** (as above) — never `mysqldump` the whole database, since it would also dump the 100+ unrelated WordPress/barbershop tables. If shell access to the host isn't available, a small Node script using `mysql2` (`SHOW CREATE TABLE` + `SELECT *` per table, against the same explicit table list) works equally well — that's how the 2026-09-14 backup was produced.

## Main domains

| Domain | Tables |
|---|---|
| **Authentication** | `users`, `password_reset_tokens` |
| **Merchants** | `merchants`, `merchant_users`, `merchant_addresses`, `merchant_bank_details` |
| **Merchant Payments** ⁋ | `merchant_payment_methods`, `merchant_payment_accounts`, `merchant_order_payments` |
| **Merchant Commission Receivable** | `merchant_commission_statements`, `merchant_commission_statement_items`, `merchant_commission_payments` |
| **Notifications** §§ | `outbound_notifications` |
| **Products** | `product_categories`, `product_types`, `products`, `product_images`, `product_options`†, `product_option_values`†, `product_variants`, `product_variant_option_values`† |
| **Inventory** | `inventory_movements` |
| **Orders** | `customer_addresses`, `order_delivery_attachments`, `carts`, `cart_items`, `shipping_methods`, `merchant_fulfilment_methods`, `coupons`, `coupon_usage`, `orders`, `merchant_orders`, `order_items`, `order_status_history`, `shipments`, `checkout_idempotency` |
| **Payments** | `payment_transactions`, `refunds`† |
| **Administration** | `merchant_payouts`, `merchant_payout_items`†, `platform_settings`, `notifications`†, `audit_logs` |
| **Community/Content** | `deck_lists`, `tournaments`, `tournament_registrations`, `tournament_teams`, `tournament_team_members`, `trade_listings`, `news`, `news_categories`, `services`, `enquiries`, `wishlists`, `wishlist_items`, `reviews` |
| **Attendent (phone app)** ¶ | `phone_tournament_checkins` (reuses `tournaments`, `tournament_registrations`, `users`, `audit_logs`) |
| **Reference data** | `countries`, `tcg_games`, `esports_games` |
| **Ticketing** ‡ | `venue_layouts`, `venue_sections`, `venue_seats`, `events`, `ticket_types`, `event_sections`, `event_seats`, `ticket_hold_sessions`, `ticket_holds`, `ticket_orders`, `ticket_order_items`, `ticket_payment_transactions`, `event_tickets` |

† = **DORMANT / RESERVED FOR PLANNED FEATURE**. These tables are schema-complete but have zero backend code referencing them as of the 2026-09-14 audit (`refunds` is referenced only in a comment/error message, not a query). They correspond to features already documented as in-progress or planned (automated payouts, refund processing, product variant options, notifications) — kept intentionally, not dead weight. Remove only if those features are formally abandoned.

‡ = **LIVE, ZERO ROWS**. Ticketing is a new domain added 2026-09-15 (schema/009_ticketing.sql). All 13 tables are live in the production database as of 2026-09-15 (via migrations 0002 + 0003) and structurally verified against this schema file — see "Ticketing" below. No events/venues have been created yet.

⁋ = **LIVE, VERIFIED**. Merchant Payments is a new domain added 2026-09-16 (schema/010_merchant_payments.sql, migrations/0004), applied to and structurally verified against the live `nanashi_collectibles` database on 2026-09-16 (all 3 tables + the `merchant_bank_details` column additions match this schema file exactly — `information_schema` column/FK/index inspection, not just `SHOW CREATE TABLE`). `merchant_payment_methods` and `merchant_payment_accounts` have real backend CRUD, functionally tested end-to-end against this live database (create/edit/keep-existing/replace-account-number/delete/set-default, method toggles, payment-account config) via a throwaway `TEST_`-prefixed merchant/user, all rows deleted afterward (0 residual). CORRECTION (2026-09-18): `merchant_order_payments` is no longer unwritten — `checkout.routes.js`'s bank-transfer checkout path (`settleBankTransferOrder`) writes real rows to it, and `merchant.routes.js`'s `POST /orders/:id/payment/confirm` reads/updates them; this was documented here as "provisioned but unwritten" from an earlier snapshot and had drifted from the actual code. See "Merchant Fulfilment + Offline Payment Methods" below for the 2026-09-18 extension (Pay on Delivery / Pay on Pickup, `merchant_fulfilment_methods`).

§§ = **SCHEMA-ONLY, NOT YET APPLIED TO ANY LIVE DATABASE**. WhatsApp Merchant Notifications is a new domain added 2026-09-16 (schema/011_notifications.sql, migrations/0005). Backend (`Backend/services/notifications/`) and frontend (Merchant Settings → Notifications) are both implemented and build/lint clean, but `migrations/0005_add_whatsapp_notifications.sql` has not yet been applied to `nanashi_collectibles` — see "WhatsApp Merchant Notifications" below.

## Current tables

All 72 tables and their columns are defined in `schema/001_core_auth.sql` through `schema/011_notifications.sql` — read those directly rather than duplicating the full column list here, since a second copy would drift. Each file's header comment explains its domain and any non-obvious design decisions.

## Ticketing

Deliberately a separate order/inventory/payment-record system from `orders`/`merchant_orders`/`order_items`/`payment_transactions` — see the header comment in `schema/009_ticketing.sql` for the full reasoning, including three additions beyond the originally-sketched 9-table list:

- **`event_sections`** — what makes General Admission a real capacity counter (`held_quantity`/`sold_quantity`, locked the same way `products.stock_quantity` is) instead of 600 fake individual seats.
- **`ticket_hold_sessions`** — groups every seat + GA line a customer selected into one basket with one authoritative `expires_at`, so the whole selection expires together instead of N independently-ticking holds. `ticket_holds` is now the per-resource row *within* a session (one row per seat, or one row per GA line); it no longer carries its own `user_id`/`expires_at` — both live on the session. `(user_id, idempotency_key)` on `ticket_hold_sessions` makes a repeated hold request (double-click, retry, reconnect) return the same session instead of creating a second reservation — same pattern as `checkout_idempotency`.
- **`ticket_payment_transactions`** and **`event_tickets`** — `payment_transactions.order_id` is `NOT NULL` and FK-bound to `orders` specifically, so it cannot be reused for ticket purchases without either faking an ecommerce order or loosening an existing, working table's constraint; `ticket_payment_transactions` mirrors it exactly against `ticket_orders` instead. `PaymentService`/`MockCyberSourceProvider`/`CyberSourceProvider` (`Backend/services/payment/`) needed **zero changes** — they never reference `payment_transactions` or `orders` themselves. `event_tickets` is the actual scannable admission — a GA line item with `quantity = 3` still issues three independent `event_tickets` rows so each attendee can be checked in separately; a reserved-seat line item issues exactly one. `token_hash` follows this schema's existing hash-don't-store convention for secrets (bcrypt passwords, `checkout_idempotency.request_hash`) — the raw scan token is generated at issuance and returned to the client once, never persisted in plain form.

**Concurrency, lock ordering, and idempotent release** are documented in full in the `schema/009_ticketing.sql` header comment — summarized: every hold/release transaction locks `EVENT_SECTIONS` rows (ascending ID) before `EVENT_SEATS` rows (ascending ID) to avoid circular-wait deadlocks on a mixed GA+reserved request; a multi-seat request is all-or-nothing (one unavailable seat fails the whole request, zero seats held); every release path (expiry worker, user cancel, checkout failure, admin action) uses a conditional `UPDATE ... WHERE STATUS = 'ACTIVE'` / `WHERE CURRENT_HOLD_ID = ?` / `WHERE HELD_QUANTITY >= ?` so a race between two release triggers can only ever succeed once.

**Verification status**: live-verified against the production database on 2026-09-15 via a read-only `information_schema` inspection — all 13 tables present with columns, FKs, indexes, defaults, and nullability matching this schema file exactly, and 0 rows in every table (no events/venues created yet). `Backend/validate_ticketing_schema.mjs` remains available for scratch-database testing of a from-scratch install of this schema (fresh + migration paths) if that's ever needed again — see its own header for usage.

**Stage 3 backend (inventory generation + hold create/release) real-integration tested 2026-09-15** against this live database — `Backend/services/ticketing/ticketInventoryService.js` and `ticketHoldService.js`, mounted at `/api/ticketing` (`Backend/routes/api/ticketing.routes.js`). A one-off test script exercised inventory initialization (incl. idempotent re-run), hold creation with pricing/seat-conflict/GA-capacity/purchase-limit checks, idempotent hold replay, hold release, idempotent double-release, ownership enforcement, and the expiry sweep — using `TEST_`-prefixed rows attached to an existing real user, all deleted afterward (verified 0 residual rows). A best-effort `setInterval` sweep in `server.js` calls `expireStaleHolds` every 30s. Not yet exercised: the REST layer itself end-to-end (the test called the service functions directly, not over HTTP), and no frontend exists yet (Stage 4+).

Applied to the live database in two steps: `migrations/0002_add_ticketing.sql` created the original 12 tables (from an earlier pre-hold-session iteration of this design, applied outside this project's own migration tooling), and `migrations/0003_reconcile_ticket_hold_sessions.sql` (2026-09-15) added `TICKET_HOLD_SESSIONS` and reconciled `TICKET_HOLDS`/`TICKET_ORDERS` with the current hold-session model — both tables had 0 rows at the time, so the column drops in 0003 involved no data loss. A schema-only backup was taken immediately before 0003: `Database/backups/ticketing_schema_only_20260915_091211.sql`.

## Merchant Payments

Lets each merchant choose which customer-facing payment method(s) they accept (bank transfer and/or online payment) instead of the marketplace hard-coding one method for everyone. Added 2026-09-16 (schema/010_merchant_payments.sql, migrations/0004) as Stage 1 of a larger, deliberately-staged feature — see the architecture audit report and CLAUDE.md §62 addendum for the full history.

- **`merchant_bank_details` is reused, not duplicated**, for the new "customer pays merchant by bank transfer" concern — it gains `DISPLAY_NAME` (customer-facing recognizable name, e.g. a storefront name — distinct from `ACCOUNT_NAME`, the legal bank account holder name), `BANK_OTHER_LABEL` (a free-text label, only meaningful when `BANK_NAME = 'OTHER'` — kept separate from the canonical `BANK_NAME` value rather than allowing arbitrary text into it), and `NOTES`. This is the same table that already held platform→merchant *payout* bank details — see "Two different money flows, one account record" below for why sharing it is safe.
- **`merchant_payment_methods`** — one row per (merchant, method) toggle. A missing row means "not enabled," never "enabled by default."
- **`merchant_payment_accounts`** — per-merchant online-payment **gateway configuration**, modeled as data separate from `merchant_bank_details` on purpose: a payment provider account is not a bank account, and different gateways can require entirely different credential shapes, so credentials are one encrypted JSON payload (`CREDENTIALS_CIPHERTEXT`/`_IV`/`_AUTH_TAG`, reusing the same AES-256-GCM helper as bank account numbers — see `Backend/modules/encryption.module.js`) rather than fixed `API_KEY`/`API_SECRET` columns. **Configuration infrastructure only as of Stage 1**: `STATUS` may only ever be written as `NOT_CONFIGURED`/`PENDING`/`DISABLED`/`ERROR` by current application code — nothing sets `ACTIVE`, and no checkout code path reads this table to route a real charge to a specific merchant's gateway account. The current online-checkout implementation (`Backend/services/payment/PaymentService.js`, `Backend/routes/api/checkout.routes.js`) still charges one platform-level provider for the whole cart, regardless of which merchants are in it — enabling `ONLINE_PAYMENT` in `merchant_payment_methods` is *setup*, not proof that funds can route directly to that merchant. Do not build a customer-facing "pay via this merchant's gateway" flow against this table until real per-merchant charge routing is implemented and verified against the actual provider.
- **`merchant_order_payments`** — the per-`merchant_order` payment record, because `orders.status` is the customer-facing *aggregate* lifecycle but a marketplace order's merchants can each be in a different payment state at the same time (Merchant A already paid by bank transfer while Merchant B still awaits theirs). **Live, with real writers as of Stage 2** (2026-09-18) — `checkout.routes.js`'s `POST /api/checkout/bank-transfer` writes rows here (`AWAITING_TRANSFER`), and `merchant.routes.js`'s `POST /orders/:id/payment/confirm` reads/confirms them (`→ PAID`). Snapshots the bank instructions shown to the customer (`SNAPSHOT_*` columns, independently re-encrypted at snapshot time — not a copy of `merchant_bank_details`' ciphertext/IV pair, and not merely a foreign key to it) so a merchant editing or deleting their bank details later can never change what an already-placed order displays; `BANK_DETAIL_ID` is kept only as an informational pointer to which saved account was used. `PAY_ON_DELIVERY`/`PAY_ON_PICKUP` rows (added 2026-09-18, see "Merchant Fulfilment + Offline Payment Methods" below) leave every `SNAPSHOT_*`/`BANK_DETAIL_ID` column `NULL` — there's no bank account involved.

**Two different money flows, one account record.** "Customer → merchant" (this feature) and "platform → merchant" (the existing `merchant_payouts` ledger, dormant/manual — see below) are deliberately kept as separate transaction domains even though they can legitimately share the same underlying bank account. `merchant_bank_details` stores the account once; nothing about this change touches `merchant_payouts` or `merchant_payout_items`.

**Status**: live and verified as of 2026-09-16 — `migrations/0004_add_merchant_payment_methods.sql` has been applied to the live `nanashi_collectibles` database (manually, by the project owner; structurally re-verified afterward via `information_schema` — columns, types, nullability, defaults, indexes, unique constraints, FKs, engine, and collation all match this schema file exactly, and every FK relationship listed in point 4 of the verification request resolved correctly). Backend CRUD for `merchant_bank_details` (extended) and `merchant_payment_methods` was functionally tested against this live database (not just unit-level) through a real running server instance and a throwaway `TEST_`-prefixed merchant/user — add/edit/"keep existing account number"/"replace account number"/delete/set-default all passed, encrypted columns (`account_number_ciphertext`/`_iv`/`_auth_tag`/`_last4`) were confirmed populated and the plaintext `account_number` column confirmed never written, and every test row was deleted afterward (0 residual rows). `merchant_payment_accounts` config-save was tested the same way (status forced to `PENDING`, never `ACTIVE`, no credentials in this stage). `merchant_order_payments` gained real writers in Stage 2 (2026-09-18) — see "Merchant Fulfilment + Offline Payment Methods" below; that stage has not itself been live-tested against the real database yet (the fresh `pay_on_delivery`/`pay_on_pickup`/`local_delivery` additions have not been applied to any live database as of this writing — build/lint clean only, same status as WhatsApp Merchant Notifications below).

**Known gap found during verification**: `Backend/.env.dev` does not currently set `MARKETPLACE_DATA_ENCRYPTION_KEY` — the bank-details write endpoints correctly refuse with `503 ENCRYPTION_NOT_CONFIGURED` in that state (by design — see `Backend/modules/encryption.module.js`), but this means the real dev/live server cannot actually save bank details until an operator sets this key. This is an environment/ops action, not a code defect — see `Backend/env.example` for the generation command. (Verification above used a real key, but generated it only in an isolated, non-committed test env file — `.env.dev` was never modified.) Since fixed: `server.js` now validates and logs this at startup and refuses to start in production without a valid key.

## Merchant Commission Receivable

Added 2026-09-18 (schema/008_platform_ops.sql, migrations/0009). The
opposite financial direction from `merchant_payouts` (Nanashi owes
merchant) — this tracks commission the **merchant** owes **Nanashi**,
which only ever accrues when a customer paid the merchant directly
(Bank Transfer / Pay on Delivery / Pay on Pickup). An Online Payment
order never generates a receivable here — Nanashi already holds that
money and nets the commission at payout time instead. See
`Backend/modules/merchantFinance.module.js` for the single place this
payment-routing rule is encoded, reused by both the existing admin
analytics endpoint and this new one.

- **`merchant_commission_statements`** — one row per billing period per
  merchant (`gross_sales`, `commission_amount`, `amount_paid`,
  `balance_due`, `due_date`). Never generated automatically — an admin
  explicitly issues one (`POST /api/admin/merchants/:id/commission-statements`),
  which snapshots every currently-unbilled, paid, direct-payment
  merchant order whose payment was confirmed within the chosen period.
- **`merchant_commission_statement_items`** — proves which merchant
  orders are on which statement. `UNIQUE(merchant_order_id)` is the
  double-charge guard: a merchant order can be billed on at most one
  statement, ever, enforced at the database level.
- **`merchant_commission_payments`** — records "merchant paid Nanashi,"
  supports partial payments. A statement's `amount_paid`/`balance_due`/
  `status` are recomputed whenever a payment is recorded.
- **Aging** combines two sources: unbilled commission (aged from
  `MERCHANT_ORDER_PAYMENTS.confirmed_at` — the moment the direct payment
  was confirmed, since nothing is invoiced yet) and billed statement
  balances (aged from days past `due_date`, floored at 0). Both use the
  same four buckets (0–30 / 31–60 / 61–90 / 90+). "Overdue" is a
  query-time condition (`due_date < today AND balance_due > 0`), never a
  stored status — no scheduler exists in this project to flip one.
- **`platform_settings` gained `commission_due_days`** (default 30) —
  reuses the existing settings table/pattern (`platform_commission_percent`
  already lived here) rather than a new configuration mechanism.
- **Status**: schema and backend/frontend code complete, build/lint
  clean — **not yet applied to any live database** as of this writing
  (`migrations/0009_add_merchant_commission_receivable.sql` not yet run).
- **Not implemented this stage**: a merchant-facing view of their own
  commission liability (Merchant Portal → Finance/Payouts), and
  statement download/print. Both are natural follow-ups once this is
  live-verified on the admin side.

## TCG Product Type

Added 2026-09-17 (schema/003_catalog.sql, migrations/0008). Lets the Shop
filter and merchant product form classify a Trading Card Games product by
*what kind* of product it is (Single Card, Booster Pack, Booster Box,
Starter Deck, Trial Deck, Structure Deck, Deck Set, Bundle / Collection,
Other) — a distinct axis from `products.tcg_game_id` (which game) and
`product_categories` (commerce category).

- **`product_types`** — new table, scoped per `category_id` (not a global
  flat list). Deliberately architected this way rather than one enum or
  per-type boolean columns on `products` (`is_booster_box`, `is_single_card`,
  ...) so a future category (Gunpla grades, Computer Parts component types,
  ...) can get its own rows later with zero schema change — just seed data.
  Mirrors `tcg_games`/`product_categories`: `SLUG` (not a separate `CODE`
  column) is the stable value application logic matches against.
- **`products.product_type_id`** — new nullable FK, `ON DELETE SET NULL`,
  same shape as `products.tcg_game_id`.
- **Requirement is data-driven, not hardcoded to one category slug**:
  `Backend/controllers/product.controller.js`'s `resolveProductTypeRequirement()`
  requires a `product_type_id` for any category that has at least one active
  `product_types` row — today that's only Trading Card Games (9 seeded
  rows), but Gunpla/Computer Parts would automatically start requiring one
  the moment rows exist for them. A category changed away from a configured
  one has its stale `product_type_id` cleared server-side regardless of
  what the client sends — same pattern as `tcg_game_id`.
- **No backfill of existing products** — every product created before this
  feature keeps `product_type_id = NULL` ("Unclassified") until a merchant
  explicitly sets one via Edit Product. Nothing guesses a product's type
  from its name, SKU, or tags.
- **Status**: schema and backend/frontend code complete, build/lint clean —
  **not yet applied to any live database** as of this writing
  (`migrations/0008_add_product_types.sql` has not been run).

## Customer Delivery Checkout

Added 2026-09-19 (schema/005_orders_checkout.sql, migrations/0007). Makes
fulfilment a real, interactive part of checkout — a real address, optional
delivery instructions, and an optional one-per-order reference photo for
Delivery orders; the merchant's own registered address (if any) for Pickup.

- **Reused, not duplicated**: `customer_addresses` already existed and is
  the address model (gains one new nullable `address_line2` column).
  `merchant_addresses` (already existed, `label` already anticipated
  `'Pickup Point'`) is surfaced as the pickup location for Pickup orders —
  never an invented address.
- **`orders.delivery_instructions`** (new, nullable, 500 chars) — one-time
  per order, not saved to the reusable address row.
- **`order_delivery_attachments`** (new table) — at most one row per order
  (`UNIQUE(order_id)`), `FILE_URL` always a backend-relative path under
  `/public/uploads/delivery-references/` that the app's own upload endpoint
  produced — never a client-supplied arbitrary URL, never a base64 blob in
  the database.
- **Scope decision: `ORDERS`, not `MERCHANT_ORDERS`.** Fulfilment (shipping
  method, address, instructions, photo) is chosen once per checkout for the
  whole cart under the existing "one shipping method per order" model
  (`orders.shipping_method_id`) — so delivery details live at the same
  level. A merchant reads their own order's delivery info by joining through
  their own `merchant_orders` row to the parent `orders` row, already
  ownership-scoped by `merchant_orders.merchant_id`. If fulfilment ever
  becomes genuinely per-merchant, this would need to move with it — it does
  not today.
- **New minimal address CRUD** (`Backend/routes/api/addresses.routes.js`,
  `GET`/`POST /api/addresses`) — list + create only, no edit/delete/manage
  screen. Existed only as a validated-but-uncreatable FK target before this;
  checkout is now the only place a new address gets created, and it's
  automatically reusable next time (no separate address-book feature was
  built).
- **New authenticated upload endpoint**: `POST /api/upload/delivery-reference`
  (server.js) — same multer pattern (disk storage, MIME-or-extension
  `fileFilter`, 5MB limit) as the existing product/avatar uploaders, in a
  separate `public/uploads/delivery-references/` directory. Unlike those two,
  this one requires `requireAuth` — it attaches to a specific customer's own
  order, not a public listing.
- **Privacy**: delivery address/phone/photo are only ever returned through
  already-ownership-scoped endpoints (`GET /api/orders/:id` — `user_id =
  req.user.sub`; `GET /api/merchant/orders/:id` — `merchant_id` resolved
  server-side from the authenticated session). The uploaded file itself is
  still served from the same unauthenticated `/public` static mount as every
  other upload in this app (product images, avatars) — filenames are
  unguessable (`Date.now()` + random suffix) but not access-controlled by a
  real authorization check. That matches this app's existing upload security
  posture exactly; it is not a new gap introduced by this feature, but is
  also not a hardened one.
- **Idempotency preserved**: a new address is created (if needed) and
  committed to page state *before* the checkout call, so a retry with the
  same `Idempotency-Key` reuses that address instead of creating a
  duplicate row. The reference photo is uploaded as a separate step before
  Place Order is even clicked, so retrying checkout never re-uploads it —
  it only ever resends the same already-uploaded URL.
- **Status**: schema and backend/frontend code complete, build/lint clean —
  **not yet applied to or verified against any live database** as of this
  writing (`migrations/0007_add_delivery_checkout_fields.sql` has not been
  run).

## Merchant Fulfilment + Offline Payment Methods

Added 2026-09-18 (schema/005_orders_checkout.sql `merchant_fulfilment_methods`, schema/010_merchant_payments.sql comment updates, migrations/0006). Lets a customer pay **Pay on Delivery** or **Pay on Pickup** — and lets each merchant say which fulfilment methods (Delivery, Pickup) they actually support, since Nanashi is multi-merchant and one merchant may not offer delivery while another does.

- **Payment method vs. fulfilment method are kept strictly separate.** `merchant_payment_methods.method` gained two values, `PAY_ON_DELIVERY` and `PAY_ON_PICKUP` — both are *payment* methods (how the customer pays), never conflated with `merchant_fulfilment_methods.method` (`DELIVERY` | `PICKUP` — how the order reaches the customer). "Delivery" itself is never a payment method.
- **`merchant_fulfilment_methods`** — one row per (merchant, method) toggle, same "missing row = disabled" convention as `merchant_payment_methods`. `Backend/modules/fulfilment.module.js` maps a `shipping_methods.code` to a fulfilment type (`'pickup'` → `PICKUP`, everything else → `DELIVERY`) — a shipping method's `code`, not its `name`, is authoritative.
- **Checkout eligibility is a joint intersection**, computed in `checkout.routes.js` `GET /api/checkout/eligibility`: a fulfilment type is offered only if every merchant in the cart enables it; a payment method is then offered only if every merchant additionally enables *that*, filtered to the chosen fulfilment type (`PAY_ON_DELIVERY` only ever appears under Delivery, `PAY_ON_PICKUP` only ever appears under Pickup). Re-verified a second time, under a fresh row lock, inside the checkout transaction itself — never trust the `GET /eligibility` read alone.
- **Offline, always.** `PAY_ON_DELIVERY`/`PAY_ON_PICKUP` never call `PaymentService.charge()` and never touch `payment_transactions` (same as `BANK_TRANSFER`) — see `isOfflinePaymentMethod()` in `merchantPayments.module.js`. No bank account, card, or gateway credential is required for either.
- **`merchant_order_payments` lifecycle differs from bank transfer.** Bank transfer moves `PENDING → AWAITING_TRANSFER → PAID` (an explicit "instructions given, awaiting the transfer" step). `PAY_ON_DELIVERY`/`PAY_ON_PICKUP` rows are created directly as `PENDING` and the merchant confirms straight to `PAID` once payment is actually collected — `MERCHANT_ORDER_PAYMENT_TRANSITIONS.PENDING` gained a direct `PAID` transition for this (`Backend/modules/orderStateMachine.module.js`).
- **Fulfilment can proceed before payment is confirmed, for these two methods only.** The existing "a merchant order's fulfilment status can't advance until its payment is `PAID`" guard (`PATCH /orders/:id/status`) is bank-transfer-specific — a courier obviously can't wait for cash to be confirmed before delivering it. The guard now only applies when `payment_method = 'BANK_TRANSFER'`.
- **Reference seed change**: `seeds/reference.sql`'s single `"Pickup / Merchant Arranged"` placeholder `shipping_methods` row is now two real rows — `Pickup` (`code='pickup'`, free) and `Local Delivery` (`code='local_delivery'`, flat fee) — so Delivery and Pickup are genuinely distinct, selectable checkout choices instead of one vague "we'll sort it out" method. `migrations/0006` performs the equivalent rename+insert against an existing database that still has only the old placeholder row, and is a no-op otherwise.
- **Status**: schema and backend/frontend code complete, build/lint clean — **not yet applied to any live database** as of this writing (same status as WhatsApp Merchant Notifications below — see §§ convention).

## WhatsApp Merchant Notifications

Transactional-only outbound notifications (not a chat system): after checkout commits, each merchant on the order gets one WhatsApp message telling them a new order arrived. Added 2026-09-16 (schema/011_notifications.sql, migrations/0005).

- **`outbound_notifications`** is a new table, not a reuse of the existing `notifications` (in-app inbox: `user_id`/`title`/`body`/`is_read`, zero delivery-channel concept, zero backend consumers). Outbound external-channel delivery needs a destination address, a provider message id, retry/attempt tracking, and per-order idempotency — a genuinely different shape, same reasoning as why `merchant_order_payments` is its own table rather than more columns on `merchant_orders`.
- **`merchants.whatsapp_phone`** (E.164) and **`merchants.whatsapp_notifications_enabled`** (defaults to 0) are new, separate from the existing `merchants.phone` — a merchant's general contact number is never assumed to be their WhatsApp number.
- **Idempotency**: `UNIQUE(merchant_order_id, channel, type)` — the row is claimed via `INSERT` before any provider is called; a duplicate-key error means "already queued/sent," so a retried checkout can never result in a duplicate WhatsApp message.
- **Provider abstraction**: `Backend/services/notifications/` — `NotificationService` → `WhatsAppService` → provider (`MockWhatsAppProvider` default, `WhatsAppCloudProvider` for the real Meta Cloud API, selected via `WHATSAPP_PROVIDER`). The cloud provider is implemented against Meta's documented request shape but has not been live-tested against a real WhatsApp Business Account — no credentials were available to verify it.
- **Status**: schema and backend/frontend code complete, build/lint clean — **not yet applied to any live database**. See §§ above.

## Relationships

- **Identity is one system, not three.** A customer, a merchant staff member, and an admin are all just rows in `users`, distinguished by `users.role` and (for merchants) a `merchant_users` membership. There is no separate `admin_users` table.
- **A merchant is a business profile**, not a login system. `merchant_users` links a `users` row to a `merchants` row with a role (`MERCHANT_OWNER` / `MERCHANT_ADMIN` / `MERCHANT_EMPLOYEE`).
- **`products.merchant_id` is nullable by design.** A standalone vendor (no merchant affiliation) is scoped by `vendor_id` instead. Both paths are live — this is a deliberate dual-scoping model, not a gap.
- **One customer order can span multiple merchants.** `orders` is what the customer sees; `merchant_orders` is each merchant's slice of it, and is the only thing a merchant's API/dashboard can query — always scoped server-side by `merchant_id` resolved from the authenticated session, never accepted from the client.
- **Financial/fulfillment records are never hard-deleted** by application code: `orders`, `merchant_orders`, `order_items`, `payment_transactions`, `refunds`, `inventory_movements` (once it has rows for a product) all use `ON DELETE RESTRICT` on their parent FK for this reason. Archive instead of deleting (`products.status = 'archived'`, `users.status = 'deleted'`, etc.).
- **Audit history survives account deletion.** `audit_logs.actor_user_id` / `actor_merchant_id` use `ON DELETE SET NULL` — deleting a user or merchant nulls out the actor reference but keeps the log row.

## Status conventions

Status columns are plain `VARCHAR`, app-validated, not `ENUM` — see "Supported engine" above for why. Current values in use:

| Table.column | Values |
|---|---|
| `users.status` | `active` \| `suspended` \| `deleted` |
| `merchants.status` | `PENDING` \| `ACTIVE` \| `SUSPENDED` \| `BANNED` \| `REJECTED` — see `Backend/modules/orderStateMachine.module.js` `MERCHANT_TRANSITIONS` for which transitions are allowed (`PENDING→ACTIVE`, `PENDING→REJECTED`, `REJECTED→ACTIVE`, `ACTIVE→SUSPENDED`, `ACTIVE→BANNED`, `SUSPENDED→ACTIVE`, `SUSPENDED→BANNED`, `BANNED→ACTIVE` as an explicit audited unban; nothing moves a merchant back to `PENDING` through the admin API today). `SUSPENDED` keeps read-only dashboard access for the merchant's own staff; `BANNED` has none. |
| `merchant_users.status` | `active` \| `suspended` \| `removed` |
| `products.status` | `active` \| `archived` \| `draft` \| `out_of_stock` |
| `product_variants.status` | `active` \| `archived` |
| `orders.status` | `PENDING_PAYMENT` \| `PAID` \| `PROCESSING` \| `READY` \| `SHIPPED` \| `DELIVERED` \| `CANCELLED` \| `REFUNDED` |
| `orders.payment_status` | `PENDING` \| `AUTHORIZED` \| `PAID` \| `FAILED` \| `CANCELLED` \| `REFUNDED` \| `PARTIALLY_REFUNDED` |
| `merchant_orders.status` | `PROCESSING` \| `READY` \| `SHIPPED` \| `DELIVERED` \| `CANCELLED` |
| `payment_transactions.status` / `refunds.status` | `PENDING` \| `AUTHORIZED`\* \| `PAID`\* \| `FAILED` \| `CANCELLED`\* \| `REFUNDED`\* \| `PARTIALLY_REFUNDED`\* (\*payment_transactions only; refunds also has `PROCESSED`) |
| `merchant_payouts.status` | `PENDING` \| `ELIGIBLE` \| `PROCESSING` \| `PAID` \| `FAILED` \| `HELD` |
| `merchant_payment_accounts.status` | `NOT_CONFIGURED` \| `PENDING` \| `ACTIVE` \| `DISABLED` \| `ERROR` — application code may only ever write `NOT_CONFIGURED`/`PENDING`/`DISABLED`/`ERROR` as of Stage 1; `ACTIVE` is reserved until real per-merchant charge routing exists and is verified — see "Merchant Payments" above |
| `merchant_order_payments.status` | `PENDING` \| `AWAITING_TRANSFER` \| `PROCESSING` \| `PAID` \| `FAILED` \| `CANCELLED` \| `REFUNDED` — see `Backend/modules/orderStateMachine.module.js` `MERCHANT_ORDER_PAYMENT_TRANSITIONS`. Bank transfer: `PENDING → AWAITING_TRANSFER → PAID`. Pay on Delivery / Pay on Pickup: `PENDING → PAID` directly — see "Merchant Fulfilment + Offline Payment Methods" above |
| `merchant_fulfilment_methods.method` | `DELIVERY` \| `PICKUP` — see `Backend/modules/fulfilment.module.js`; no status column, just `enabled` (boolean) |
| `outbound_notifications.status` | `PENDING` \| `SENT` \| `FAILED` \| `SKIPPED` — see "WhatsApp Merchant Notifications" above; not yet applied to any live database |
| `outbound_notifications.channel` | `WHATSAPP` (only channel implemented) |
| `outbound_notifications.type` | `NEW_ORDER` (only type implemented; `PAYMENT_RECEIVED` \| `ORDER_CANCELLED` \| `LOW_STOCK` \| `DISPUTE_OPENED` \| `PAYOUT_PROCESSED` are documented future types, not built) |
| `news.status` | `draft` \| `published` |
| `enquiries.status` | `new` \| `in_progress` \| `resolved` \| `closed` |
| `reviews.status` | `published` \| `flagged` \| `removed` |
| `checkout_idempotency.status` | `PROCESSING` \| `COMPLETED` \| `FAILED` |
| `events.status` | `draft` \| `published` \| `cancelled` \| `archived` |
| `events.sale_status` | `not_open` \| `on_sale` \| `paused` \| `sold_out` \| `closed` |
| `venue_layouts.status` / `venue_sections.status` / `venue_seats.status` | `active` \| `draft` \| `archived` (layouts) — `active` \| `disabled` (sections) — `active` \| `removed` (seats) |
| `ticket_types.status` | `active` \| `hidden` |
| `event_seats.status` | `available` \| `held` \| `sold` \| `blocked` \| `unavailable` |
| `ticket_hold_sessions.status` / `ticket_holds.status` | `ACTIVE` \| `CONVERTED` \| `RELEASED` \| `EXPIRED` — a session groups every seat/GA line a customer selected together; `ticket_holds` is the per-resource row within one session (see "Ticketing" below) |
| `ticket_orders.status` | `PENDING_PAYMENT` \| `PAID` \| `CANCELLED` \| `REFUNDED` \| `EXPIRED` |
| `ticket_payment_transactions.status` | `PENDING` \| `AUTHORIZED` \| `PAID` \| `FAILED` \| `CANCELLED` \| `REFUNDED` \| `PARTIALLY_REFUNDED` — same vocabulary as `payment_transactions.status`, separate table (see "Ticketing" below) |
| `event_tickets.status` | `ISSUED` \| `USED` \| `VOID` \| `REFUNDED` |

Other app-validated (non-status) controlled vocabularies, also plain `VARCHAR` rather than `ENUM`: `merchant_bank_details.bank_name` (`BIBD` \| `BAIDURI` \| `TAIB` \| `OTHER`, with `bank_other_label` carrying the free-text label only when `OTHER`) and `merchant_payment_methods.method` / `merchant_order_payments.payment_method` (`BANK_TRANSFER` \| `ONLINE_PAYMENT`) — see `Backend/modules/merchantPayments.module.js`.

The authoritative transition tables for order/merchant-order/payment/merchant statuses live in `Backend/modules/orderStateMachine.module.js` — this is the single place backend route files import from rather than hand-rolling their own transition logic; if you change allowed statuses or transitions, change it there and this table falls out of sync until updated.

## Known items

- `merchant_bank_details.account_number` (plaintext) is deprecated but not yet dropped — see the comment in `schema/004_merchants.sql`. Do not write to it; use the `account_number_ciphertext`/`_iv`/`_auth_tag`/`_last4` columns instead.
- `countries` has no seed data yet (empty live table) — no seed file currently populates it.
- `merchant_payouts` has a read endpoint but no create path in the app yet — payouts are recorded manually today.
- `merchant_payment_accounts.status` can only ever be set to a non-`ACTIVE` value by current backend code — see "Merchant Payments" above. Do not treat a `PENDING` row as proof that online payments actually route to that merchant.
- `merchant_order_payments` now has a real backend writer (Stage 2, `checkout.routes.js` bank-transfer path) and a confirmation endpoint (`merchant.routes.js`), live-verified 2026-09-16.
- `outbound_notifications` and `merchants.whatsapp_phone`/`whatsapp_notifications_enabled` are code-complete but **schema-only** — `migrations/0005_add_whatsapp_notifications.sql` has not yet been applied to any live database. See "WhatsApp Merchant Notifications" above.

## Attendent tournament check-in (phone app)

¶ Added 2026-11-09 (schema/007_content_community.sql, migrations/0010). The Attendent mobile app (`Phone/Attendent/attendent`) lets an **admin** check registered participants (account holders and guests) in to a tournament via `Backend/routes/api/attendance.routes.js` (`/api/attendance/*`).

- **Reused**: `tournaments` (what people check in to), `tournament_registrations` (who; its existing `status = 'checked_in'` value is now actually set, in the same transaction), `users` (the admin), `audit_logs` (`TOURNAMENT_CHECKIN`).
- **New, `PHONE_`-prefixed (new table owned by the phone app)**: `phone_tournament_checkins` — one row per checked-in registration, recording when and by which admin. `tournament_registrations` has no when/by-whom columns, and a separate table keeps that live, high-blast-radius table unaltered. `UNIQUE(registration_id)` is the duplicate guard (one check-in per person per tournament); a composite FK `(registration_id, tournament_id)` reuses `uq_registrations_id_tournament`; `ON DELETE CASCADE` keeps the existing leave/delete flows working.
- **Duplicate contract**: first check-in → `201`, `alreadyCheckedIn: false`; any repeat (retry, double tap, second device) → `200`, `alreadyCheckedIn: true` with the original time/admin, never a second row.
- **Status**: **SCHEMA-ONLY, NOT YET APPLIED TO ANY LIVE DATABASE.** Purely additive and idempotent. Verified only against a throwaway local MariaDB 10.6.28 (fresh `All.sql` install + migration applied twice): API auth/validation/state cases, 50 concurrent submissions → exactly one row per registration, unique key and composite FK rejecting bad rows directly.

