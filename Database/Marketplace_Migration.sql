-- ================================================================
-- NanashiCollectibles Marketplace Migration
-- ================================================================
-- Purely additive extension of Database/NanashiCollectibles_v2.sql.
-- Adds the multi-merchant marketplace layer: merchant business
-- profiles/staff, product variants, carts, wishlists, orders (with
-- per-merchant order splitting), payments, shipping, coupons,
-- reviews, merchant payouts/commission, refunds, notifications, and
-- an audit log.
--
-- This script does NOT:
--   - DROP or TRUNCATE any existing table
--   - rename or remove any existing column
--   - destructively ALTER any existing column
--   - insert any customer, order, or payment data
--
-- The only changes to existing tables are additive:
--   ALTER TABLE products ...            (new nullable columns only)
--   ALTER TABLE inventory_movements ...  (one new nullable column)
-- Both are listed explicitly in SECTION 2 below, run only after the
-- tables they reference (merchants, product_variants) exist.
--
-- Conventions, kept identical to NanashiCollectibles_v2.sql:
--   - InnoDB / utf8mb4 / utf8mb4_unicode_ci
--   - snake_case, plural table names
--   - INT UNSIGNED AUTO_INCREMENT primary keys
--   - money columns are DECIMAL(10,2) — never FLOAT/DOUBLE/INT
--   - status/role/type columns are VARCHAR, app-validated — no ENUM,
--     no CHECK constraints (MySQL < 8.0.16 silently ignores CHECK;
--     the engine/version running this script was never confirmed)
--   - table creation order is real dependency order; no
--     FOREIGN_KEY_CHECKS toggling anywhere in this script
--   - "archive, don't cascade away business records": any table that
--     represents money or fulfillment history uses ON DELETE RESTRICT
--     on its parent FK; pure detail/child rows (images, line items of
--     a thing that is itself never deleted) use ON DELETE CASCADE
--
-- Run this AFTER Database/NanashiCollectibles_v2.sql. Select your
-- NanashiCollectibles database before running this script.
-- USE `your_nanashicollectibles_schema`;
-- ================================================================


-- ================================================================
-- SECTION 1 — MERCHANT BUSINESS LAYER
-- ================================================================
-- A "merchant" is a business profile. It does NOT replace the existing
-- users.role = 'VENDOR' concept or introduce a parallel auth/session
-- system — merchant staff authenticate through the existing
-- POST /api/auth/login (users + JWT), exactly like every other account.
-- merchant_users links an existing users row to a merchant with a role.
-- Identity for "which merchant is this request acting on behalf of"
-- must always be resolved server-side from merchant_users for the
-- authenticated user — never accepted from the client.

CREATE TABLE merchants (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_name       VARCHAR(150) NOT NULL,
  display_name        VARCHAR(150) NOT NULL,
  slug                VARCHAR(180) NOT NULL,
  contact_person      VARCHAR(100) NOT NULL,
  email               VARCHAR(100) NOT NULL,
  phone               VARCHAR(20)  NULL,
  business_category   VARCHAR(50)  NULL,               -- e.g. 'tcg' | 'collectibles' | 'gunpla' | 'drone' | 'computer_parts' | 'general' — app-validated
  status              VARCHAR(20)  NOT NULL DEFAULT 'PENDING', -- PENDING | ACTIVE | SUSPENDED | REJECTED
  commission_percent  DECIMAL(5,2) NULL,                -- override; NULL = use platform_settings.platform_commission_percent
  social_links        TEXT NULL,                        -- JSON-encoded, app-validated
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_merchants_slug (slug),
  UNIQUE KEY uq_merchants_email (email),
  INDEX idx_merchants_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- New merchants default to PENDING and must not receive unrestricted
-- marketplace access (create/list live products, receive orders) until
-- an admin sets status = 'ACTIVE'. Enforce this in backend middleware,
-- not just at registration time.

CREATE TABLE merchant_users (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  merchant_id  INT UNSIGNED NOT NULL,
  user_id      INT UNSIGNED NOT NULL,
  role         VARCHAR(20)  NOT NULL DEFAULT 'MERCHANT_OWNER', -- MERCHANT_OWNER | MERCHANT_ADMIN | MERCHANT_EMPLOYEE
  status       VARCHAR(20)  NOT NULL DEFAULT 'active',         -- active | suspended | removed
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_merchant_users_merchant
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  CONSTRAINT fk_merchant_users_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_merchant_users_merchant_user (merchant_id, user_id),
  INDEX idx_merchant_users_user (user_id),
  INDEX idx_merchant_users_merchant (merchant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE merchant_addresses (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  merchant_id   INT UNSIGNED NOT NULL,
  label         VARCHAR(50)  NULL,                      -- e.g. 'Pickup Point', 'Warehouse'
  address_line1 VARCHAR(255) NOT NULL,
  district      VARCHAR(100) NULL,
  mukim         VARCHAR(100) NULL,
  village       VARCHAR(100) NULL,
  postcode      VARCHAR(20)  NULL,
  country_code  CHAR(2)      NOT NULL DEFAULT 'BN',
  is_default    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_merchant_addresses_merchant
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  INDEX idx_merchant_addresses_merchant (merchant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE merchant_bank_details (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  merchant_id           INT UNSIGNED NOT NULL,
  bank_name             VARCHAR(150) NOT NULL,
  account_name          VARCHAR(150) NOT NULL,
  account_number        VARCHAR(50)  NOT NULL,          -- SENSITIVE: see security note below
  swift_code            VARCHAR(20)  NULL,
  currency              CHAR(3)      NOT NULL DEFAULT 'BND',
  is_default            TINYINT(1)   NOT NULL DEFAULT 0,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_merchant_bank_details_merchant
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  INDEX idx_merchant_bank_details_merchant (merchant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- SECURITY NOTE: account_number is financial PII. This script stores it in
-- plain columns because this database has no field-level encryption
-- mechanism configured. Before handling real bank details in production:
-- encrypt account_number at rest (application-level encryption, not just
-- disk encryption), restrict backend responses to a masked value
-- (e.g. last 4 digits) by default, and never log this table's contents.
-- Payouts are recorded manually by admin per the PLATFORM COMMISSION /
-- MERCHANT PAYOUT sections below — no automated fund transfer is
-- implemented anywhere in this migration.


-- ================================================================
-- SECTION 2 — PRODUCT EXTENSIONS (additive only)
-- ================================================================
-- Existing products/inventory_movements tables and all existing
-- columns/constraints are untouched. Everything below only adds
-- nullable/defaulted columns or brand-new child tables.

ALTER TABLE products
  ADD COLUMN merchant_id         INT UNSIGNED NULL AFTER vendor_id,
  ADD COLUMN short_description   VARCHAR(500) NULL AFTER description,
  ADD COLUMN brand               VARCHAR(100) NULL AFTER short_description,
  ADD COLUMN low_stock_threshold INT UNSIGNED NULL AFTER stock_quantity,
  ADD COLUMN featured            TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN weight_grams        INT UNSIGNED NULL AFTER featured,
  ADD COLUMN tags                VARCHAR(255) NULL AFTER weight_grams,
  ADD CONSTRAINT fk_products_merchant
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE SET NULL,
  ADD INDEX idx_products_merchant (merchant_id);
-- merchant_id is nullable and additive: existing products keep working
-- unchanged via vendor_id. New products created by a merchant-affiliated
-- vendor should have merchant_id set server-side (resolved from
-- merchant_users for the authenticated user — never from client input).
--
-- products.status remains VARCHAR(20), app-validated (no DB enum/CHECK,
-- consistent with the base schema). The existing 'active' | 'archived'
-- values keep working; application code should additionally accept
-- 'draft' and 'out_of_stock' as valid values going forward.

-- Simple, standard variant model (deliberately not over-normalized
-- beyond this): an option is a named axis (e.g. "Colour"), an option
-- value is one choice on that axis (e.g. "Red"), a variant is one
-- concrete SKU-able combination, linked to the option values that make
-- it up.

CREATE TABLE product_options (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED NOT NULL,
  name        VARCHAR(50) NOT NULL,                     -- e.g. 'Colour', 'Size', 'Language'
  sort_order  INT UNSIGNED NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_options_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uq_product_options_product_name (product_id, name),
  INDEX idx_product_options_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_option_values (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  option_id  INT UNSIGNED NOT NULL,
  value      VARCHAR(100) NOT NULL,                     -- e.g. 'Red', 'M', 'Japanese'
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_option_values_option
    FOREIGN KEY (option_id) REFERENCES product_options(id) ON DELETE CASCADE,
  UNIQUE KEY uq_product_option_values_option_value (option_id, value),
  INDEX idx_product_option_values_option (option_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_variants (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id      INT UNSIGNED NOT NULL,
  sku             VARCHAR(100) NULL,
  price_override  DECIMAL(10,2) NULL,                   -- NULL = use products.price
  stock_quantity  INT UNSIGNED NOT NULL DEFAULT 0,       -- single source of truth for THIS variant, mirrors products.stock_quantity's role
  status          VARCHAR(20) NOT NULL DEFAULT 'active', -- active | archived
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_variants_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_product_variants_sku (sku),
  INDEX idx_product_variants_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- ON DELETE RESTRICT, same reasoning as inventory_movements -> products:
-- a variant with recorded stock/order history must never be silently
-- orphaned by a product delete. Archive the product instead once it has
-- variants with history.

CREATE TABLE product_variant_option_values (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  variant_id       INT UNSIGNED NOT NULL,
  option_value_id  INT UNSIGNED NOT NULL,
  CONSTRAINT fk_pvov_variant
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
  CONSTRAINT fk_pvov_option_value
    FOREIGN KEY (option_value_id) REFERENCES product_option_values(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_pvov_variant_option_value (variant_id, option_value_id),
  INDEX idx_pvov_option_value (option_value_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE inventory_movements
  ADD COLUMN variant_id INT UNSIGNED NULL AFTER product_id,
  ADD CONSTRAINT fk_inventory_movements_variant
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
  ADD INDEX idx_inventory_movements_variant (variant_id);
-- NULL variant_id = movement applies to the base product (unchanged,
-- existing behavior). Non-NULL = movement applies to that specific
-- variant. BACKEND REQUIREMENT (same discipline as the base schema):
-- any write that changes product_variants.stock_quantity must, in the
-- same transaction, insert the matching inventory_movements row.


-- ================================================================
-- SECTION 3 — CUSTOMER ADDRESSES
-- ================================================================

CREATE TABLE customer_addresses (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id               INT UNSIGNED NOT NULL,
  label                 VARCHAR(50)  NULL,
  recipient_name        VARCHAR(100) NOT NULL,
  phone                 VARCHAR(20)  NULL,
  address_line1         VARCHAR(255) NOT NULL,
  district              VARCHAR(100) NULL,
  mukim                 VARCHAR(100) NULL,
  village               VARCHAR(100) NULL,
  postcode              VARCHAR(20)  NULL,
  country_code          CHAR(2)      NOT NULL DEFAULT 'BN',
  is_default_shipping   TINYINT(1)   NOT NULL DEFAULT 0,
  is_default_billing    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_customer_addresses_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_customer_addresses_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ================================================================
-- SECTION 4 — CART / WISHLIST
-- ================================================================

CREATE TABLE carts (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NULL,                        -- NULL for a guest cart
  guest_token CHAR(36)     NULL,                         -- app-generated UUID, stored client-side, for guest carts
  status      VARCHAR(20)  NOT NULL DEFAULT 'active',    -- active | converted | abandoned
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_carts_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_carts_user (user_id),          -- MySQL does not enforce uniqueness among NULLs, so this never blocks multiple guest carts
  UNIQUE KEY uq_carts_guest_token (guest_token),
  INDEX idx_carts_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cart_items (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cart_id     INT UNSIGNED NOT NULL,
  product_id  INT UNSIGNED NOT NULL,
  variant_id  INT UNSIGNED NULL,
  variant_key INT UNSIGNED GENERATED ALWAYS AS (COALESCE(variant_id, 0)) STORED, -- lets the unique key below treat "no variant" as one consistent value, since a plain UNIQUE KEY does not enforce uniqueness across NULLs
  quantity    INT UNSIGNED NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_items_cart
    FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_variant
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cart_items_cart_product_variant (cart_id, product_id, variant_key),
  INDEX idx_cart_items_cart (cart_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Cart pricing is NEVER read from this table at checkout time — it only
-- records product/variant + quantity. Checkout must always recompute
-- price/subtotal/discount/shipping/total from current database values.

CREATE TABLE wishlists (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wishlists_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_wishlists_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE wishlist_items (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  wishlist_id  INT UNSIGNED NOT NULL,
  product_id   INT UNSIGNED NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wishlist_items_wishlist
    FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE,
  CONSTRAINT fk_wishlist_items_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uq_wishlist_items_wishlist_product (wishlist_id, product_id),
  INDEX idx_wishlist_items_wishlist (wishlist_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ================================================================
-- SECTION 5 — SHIPPING
-- ================================================================

CREATE TABLE shipping_methods (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  code         VARCHAR(30)  NOT NULL,                   -- 'pickup' | 'local_delivery' | 'courier' | 'international' — app-validated, open to more later
  description  VARCHAR(255) NULL,
  base_fee     DECIMAL(10,2) NOT NULL DEFAULT 0,
  status       VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_shipping_methods_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Intended seed rows (not included here — see Marketplace_Migration_seed.sql):
-- Pickup, Local Delivery.


-- ================================================================
-- SECTION 6 — ORDERS (multi-merchant order splitting)
-- ================================================================
-- One customer order (orders) can contain items from multiple
-- merchants. Each merchant's slice of that order is a merchant_order —
-- this is what a merchant's dashboard/API can see and act on. Customers
-- see the whole `orders` row; merchants only ever see their own
-- `merchant_orders` row and its `order_items`.
--
-- Orders, merchant_orders, and order_items are financial/fulfillment
-- records and are never hard-deleted by application code — all
-- corresponding FKs below use ON DELETE RESTRICT for that reason.

CREATE TABLE orders (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number         VARCHAR(30)  NOT NULL,            -- app-generated after insert, e.g. 'NC00001'
  user_id              INT UNSIGNED NOT NULL,
  shipping_address_id  INT UNSIGNED NULL,
  billing_address_id   INT UNSIGNED NULL,
  shipping_method_id   INT UNSIGNED NULL,
  coupon_id            INT UNSIGNED NULL,
  subtotal             DECIMAL(10,2) NOT NULL,
  discount_total        DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping_total        DECIMAL(10,2) NOT NULL DEFAULT 0,
  grand_total           DECIMAL(10,2) NOT NULL,
  currency              CHAR(3) NOT NULL DEFAULT 'BND',
  payment_status        VARCHAR(20) NOT NULL DEFAULT 'PENDING',        -- PENDING | AUTHORIZED | PAID | FAILED | CANCELLED | REFUNDED | PARTIALLY_REFUNDED
  status                VARCHAR(20) NOT NULL DEFAULT 'PENDING_PAYMENT', -- PENDING_PAYMENT | PAID | PROCESSING | READY | SHIPPED | DELIVERED | CANCELLED | REFUNDED
  placed_at             TIMESTAMP NULL,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_shipping_address
    FOREIGN KEY (shipping_address_id) REFERENCES customer_addresses(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_billing_address
    FOREIGN KEY (billing_address_id) REFERENCES customer_addresses(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_shipping_method
    FOREIGN KEY (shipping_method_id) REFERENCES shipping_methods(id) ON DELETE SET NULL,
  UNIQUE KEY uq_orders_order_number (order_number),
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_status (status),
  INDEX idx_orders_payment_status (payment_status),
  INDEX idx_orders_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- coupon_id FK is added after the coupons table exists (SECTION 8).
-- Orders always belong to a registered user in this version — guest
-- carts are supported, but checkout requires an authenticated account
-- so order history/tracking has somewhere to live. Guest checkout
-- (order placed without an account) is a possible future extension,
-- not implemented here.

CREATE TABLE merchant_orders (
  id                     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  merchant_order_number  VARCHAR(40)  NOT NULL,          -- app-generated after insert, e.g. 'MO000001'
  order_id               INT UNSIGNED NOT NULL,
  merchant_id            INT UNSIGNED NOT NULL,
  subtotal               DECIMAL(10,2) NOT NULL,
  commission_percent     DECIMAL(5,2)  NOT NULL,         -- snapshot at order time — do not recompute later from merchants.commission_percent
  commission_amount      DECIMAL(10,2) NOT NULL,
  merchant_net_amount    DECIMAL(10,2) NOT NULL,
  status                 VARCHAR(20) NOT NULL DEFAULT 'PROCESSING', -- PROCESSING | READY | SHIPPED | DELIVERED | CANCELLED
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_merchant_orders_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_merchant_orders_merchant
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_merchant_orders_number (merchant_order_number),
  INDEX idx_merchant_orders_order (order_id),
  INDEX idx_merchant_orders_merchant (merchant_id),
  INDEX idx_merchant_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- A merchant's REST session must only ever be able to SELECT rows here
-- WHERE merchant_id = <resolved from merchant_users for the
-- authenticated user>. Never accept merchant_id from the client.

CREATE TABLE order_items (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id            INT UNSIGNED NOT NULL,
  merchant_order_id   INT UNSIGNED NOT NULL,
  product_id          INT UNSIGNED NOT NULL,
  variant_id          INT UNSIGNED NULL,
  product_name_snapshot  VARCHAR(150) NOT NULL,          -- product name/price/etc. can change after purchase; the order must not depend on current PRODUCT data
  sku_snapshot           VARCHAR(100) NULL,
  unit_price_snapshot    DECIMAL(10,2) NOT NULL,
  quantity               INT UNSIGNED NOT NULL,
  line_total             DECIMAL(10,2) NOT NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_items_merchant_order
    FOREIGN KEY (merchant_order_id) REFERENCES merchant_orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_items_variant
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
  INDEX idx_order_items_order (order_id),
  INDEX idx_order_items_merchant_order (merchant_order_id),
  INDEX idx_order_items_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_status_history (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id             INT UNSIGNED NOT NULL,
  merchant_order_id    INT UNSIGNED NULL,                -- set when the change is a merchant-order-level fulfillment update
  old_status           VARCHAR(20) NULL,
  new_status           VARCHAR(20) NOT NULL,
  changed_by_type      VARCHAR(20) NOT NULL,              -- customer | merchant | admin | system
  changed_by_user_id   INT UNSIGNED NULL,
  note                 TEXT NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_status_history_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_status_history_merchant_order
    FOREIGN KEY (merchant_order_id) REFERENCES merchant_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_status_history_user
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_order_status_history_order (order_id),
  INDEX idx_order_status_history_merchant_order (merchant_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- CASCADE here is safe: orders/merchant_orders are never hard-deleted by
-- application code (see the section header note), so this never
-- actually fires in practice; it just avoids an unnecessary RESTRICT.

CREATE TABLE shipments (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  merchant_order_id    INT UNSIGNED NOT NULL,
  shipping_method_id   INT UNSIGNED NULL,
  carrier              VARCHAR(100) NULL,
  tracking_number      VARCHAR(100) NULL,
  status               VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | SHIPPED | DELIVERED
  shipped_at           TIMESTAMP NULL,
  delivered_at         TIMESTAMP NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shipments_merchant_order
    FOREIGN KEY (merchant_order_id) REFERENCES merchant_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_shipments_shipping_method
    FOREIGN KEY (shipping_method_id) REFERENCES shipping_methods(id) ON DELETE SET NULL,
  UNIQUE KEY uq_shipments_merchant_order (merchant_order_id), -- one shipment per merchant order for now; relax this uniqueness if partial/split shipments are needed later
  INDEX idx_shipments_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ================================================================
-- SECTION 7 — PAYMENTS
-- ================================================================

CREATE TABLE payment_transactions (
  id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id                INT UNSIGNED NOT NULL,
  provider                VARCHAR(30) NOT NULL,          -- 'mock_cybersource' | 'cybersource' — matches PaymentService provider ids
  provider_transaction_id VARCHAR(100) NULL,
  amount                  DECIMAL(10,2) NOT NULL,
  currency                CHAR(3) NOT NULL DEFAULT 'BND',
  status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | AUTHORIZED | PAID | FAILED | CANCELLED | REFUNDED | PARTIALLY_REFUNDED
  raw_response            LONGTEXT NULL,                  -- sanitized JSON only — never store raw PAN/CVV here or anywhere
  created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_transactions_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  INDEX idx_payment_transactions_order (order_id),
  INDEX idx_payment_transactions_status (status),
  INDEX idx_payment_transactions_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Each attempt (including retries) is its own row — this table doubles
-- as the payment-attempt log, so a separate payment_attempts table
-- was deliberately not added (see Marketplace_Migration docs note on
-- consolidation).

CREATE TABLE refunds (
  id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id                INT UNSIGNED NOT NULL,
  payment_transaction_id  INT UNSIGNED NOT NULL,
  amount                  DECIMAL(10,2) NOT NULL,
  reason                  VARCHAR(255) NULL,
  status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | PROCESSED | FAILED
  processed_by_user_id    INT UNSIGNED NULL,
  created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_refunds_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_refunds_payment_transaction
    FOREIGN KEY (payment_transaction_id) REFERENCES payment_transactions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_refunds_processed_by
    FOREIGN KEY (processed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_refunds_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ================================================================
-- SECTION 8 — COUPONS
-- ================================================================

CREATE TABLE coupons (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code                  VARCHAR(50) NOT NULL,
  description           VARCHAR(255) NULL,
  discount_type         VARCHAR(20) NOT NULL,             -- 'percent' | 'fixed'
  discount_value        DECIMAL(10,2) NOT NULL,
  min_subtotal          DECIMAL(10,2) NULL,
  max_uses              INT UNSIGNED NULL,
  max_uses_per_user     INT UNSIGNED NULL,
  starts_at             TIMESTAMP NULL,
  ends_at               TIMESTAMP NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_coupons_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE orders
  ADD CONSTRAINT fk_orders_coupon
    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL;

CREATE TABLE coupon_usage (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  coupon_id   INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  order_id    INT UNSIGNED NOT NULL,
  used_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_coupon_usage_coupon
    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  CONSTRAINT fk_coupon_usage_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_coupon_usage_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  INDEX idx_coupon_usage_coupon_user (coupon_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- max_uses / max_uses_per_user are enforced in application logic (count
-- rows here), not as DB constraints — consistent with this schema's
-- "no CHECK constraints" policy.


-- ================================================================
-- SECTION 9 — REVIEWS
-- ================================================================

CREATE TABLE reviews (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id     INT UNSIGNED NOT NULL,
  user_id        INT UNSIGNED NOT NULL,
  order_item_id  INT UNSIGNED NULL,                       -- set when this review is linked to a verified purchase
  rating         TINYINT UNSIGNED NOT NULL,                -- 1-5, app-validated (no CHECK — see file header policy)
  title          VARCHAR(150) NULL,
  body           TEXT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'published', -- published | flagged | removed
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reviews_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_order_item
    FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL,
  UNIQUE KEY uq_reviews_product_user (product_id, user_id),
  INDEX idx_reviews_product (product_id),
  INDEX idx_reviews_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- A merchant must never be able to edit review title/body/rating — only
-- product_id ownership does not grant that; enforce in backend by simply
-- never exposing a review-edit endpoint to merchant roles.


-- ================================================================
-- SECTION 10 — MERCHANT PAYOUTS / PLATFORM COMMISSION
-- ================================================================
-- No automated fund transfer is implemented. Payouts are recorded here
-- by admin action (manually, or via a future batch job) once a
-- merchant_order is eligible.

CREATE TABLE merchant_payouts (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  merchant_id         INT UNSIGNED NOT NULL,
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  gross_amount        DECIMAL(10,2) NOT NULL,
  commission_amount   DECIMAL(10,2) NOT NULL,
  net_amount          DECIMAL(10,2) NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | ELIGIBLE | PROCESSING | PAID | FAILED | HELD
  paid_at             TIMESTAMP NULL,
  notes               TEXT NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_merchant_payouts_merchant
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE RESTRICT,
  INDEX idx_merchant_payouts_merchant (merchant_id),
  INDEX idx_merchant_payouts_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE merchant_payout_items (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  merchant_payout_id   INT UNSIGNED NOT NULL,
  merchant_order_id    INT UNSIGNED NOT NULL,
  amount               DECIMAL(10,2) NOT NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_merchant_payout_items_payout
    FOREIGN KEY (merchant_payout_id) REFERENCES merchant_payouts(id) ON DELETE CASCADE,
  CONSTRAINT fk_merchant_payout_items_merchant_order
    FOREIGN KEY (merchant_order_id) REFERENCES merchant_orders(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_merchant_payout_items_merchant_order (merchant_order_id), -- a merchant_order can only ever be paid out once
  INDEX idx_merchant_payout_items_payout (merchant_payout_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE platform_settings (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  setting_key   VARCHAR(100) NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  description   VARCHAR(255) NULL,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_platform_settings_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Required operational default (not sample/demo content — the backend's
-- commission calculation has no fallback if this row is missing).
INSERT INTO platform_settings (setting_key, setting_value, description) VALUES
  ('platform_commission_percent', '10.00', 'Default marketplace commission percentage applied to new merchant orders when a merchant has no commission_percent override.');


-- ================================================================
-- SECTION 11 — NOTIFICATIONS / AUDIT LOG
-- ================================================================

CREATE TABLE notifications (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  type        VARCHAR(50) NOT NULL,                       -- e.g. 'ORDER_PLACED', 'ORDER_SHIPPED', 'MERCHANT_APPROVED'
  title       VARCHAR(150) NOT NULL,
  body        TEXT NULL,
  is_read     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user (user_id),
  INDEX idx_notifications_is_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id      INT UNSIGNED NULL,
  actor_merchant_id  INT UNSIGNED NULL,
  action             VARCHAR(100) NOT NULL,                -- e.g. 'PRODUCT_CREATED', 'STOCK_ADJUSTED', 'ORDER_STATUS_CHANGED'
  entity_type        VARCHAR(50) NOT NULL,
  entity_id          VARCHAR(50) NOT NULL,
  metadata           LONGTEXT NULL,                        -- JSON-encoded, app-validated; never store secrets/PII beyond what's already elsewhere in this schema
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_actor_user
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_audit_logs_actor_merchant
    FOREIGN KEY (actor_merchant_id) REFERENCES merchants(id) ON DELETE SET NULL,
  INDEX idx_audit_logs_actor_user (actor_user_id),
  INDEX idx_audit_logs_entity (entity_type, entity_id),
  INDEX idx_audit_logs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ================================================================
-- END OF Marketplace Migration
-- 24 new tables, 2 additively-altered existing tables
-- (products, inventory_movements), 1 required operational config row
-- (platform_settings). No destructive statements, nothing executed.
-- ================================================================
