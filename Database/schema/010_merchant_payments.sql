-- ================================================================
-- 010 — MERCHANT PAYMENTS (per-merchant payment method configuration)
-- ================================================================
-- Added for Merchant Payments Stage 1 (2026-09-16). Lets each merchant
-- choose which customer-facing payment method(s) they accept — bank
-- transfer and/or online payment — rather than the marketplace hard-coding
-- one method for every merchant. See the architecture audit / CLAUDE.md
-- §62 addendum for the full reasoning; summarized here:
--
--   MERCHANT_PAYMENT_METHODS  — per-merchant on/off toggle for each method.
--   MERCHANT_PAYMENT_ACCOUNTS — per-merchant online-payment GATEWAY
--     configuration, modeled separately from MERCHANT_BANK_DETAILS on
--     purpose (a "payment provider" is not a "bank account" — see
--     Database/README.md "Merchant Payments"). SCHEMA-COMPLETE, CONFIG-ONLY
--     as of this migration: no checkout code path reads STATUS to route a
--     real charge to a specific merchant's gateway account yet, and no
--     application code may set STATUS = 'ACTIVE' until that routing is
--     implemented and verified against the actual provider — see the
--     STATUS column comment below and Backend/services/payment/PaymentService.js.
--   MERCHANT_ORDER_PAYMENTS   — the per-MERCHANT_ORDER payment record this
--     whole feature exists for. A marketplace order can contain several
--     merchants; ORDERS.STATUS is the customer-facing AGGREGATE lifecycle,
--     but each merchant is paid (or awaits payment) independently — this
--     table is the per-merchant authority for that. PROVISIONED IN THIS
--     MIGRATION, NOT YET WRITTEN TO by any route — checkout.routes.js does
--     not create rows here yet (that is Stage 2: wiring the actual
--     customer-facing bank-transfer checkout flow). Snapshots the bank
--     instructions shown to the customer at the time BANK_TRANSFER was
--     selected (its own independently-encrypted copy — see the SNAPSHOT_*
--     columns below), rather than pointing at the mutable
--     MERCHANT_BANK_DETAILS row, so a merchant editing/deleting their bank
--     details later can never change what an already-placed order displays.
-- ================================================================

CREATE TABLE MERCHANT_PAYMENT_METHODS (
  ID           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  MERCHANT_ID  INT UNSIGNED NOT NULL,
  METHOD       VARCHAR(20)  NOT NULL,                    -- app-validated: BANK_TRANSFER | ONLINE_PAYMENT | PAY_ON_DELIVERY | PAY_ON_PICKUP — see Backend/modules/merchantPayments.module.js. PAY_ON_DELIVERY/PAY_ON_PICKUP are payment methods, gated by fulfilment type at checkout (see MERCHANT_FULFILMENT_METHODS, 005_orders_checkout.sql) — "Delivery" itself is never a payment method. QR_PAYMENT deliberately NOT added yet (future design consideration only).
  ENABLED      TINYINT(1)   NOT NULL DEFAULT 0,
  CREATED_AT   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_MERCHANT_PAYMENT_METHODS_MERCHANT
    FOREIGN KEY (MERCHANT_ID) REFERENCES MERCHANTS(ID) ON DELETE CASCADE,
  UNIQUE KEY UQ_MERCHANT_PAYMENT_METHODS_MERCHANT_METHOD (MERCHANT_ID, METHOD),
  INDEX IDX_MERCHANT_PAYMENT_METHODS_MERCHANT (MERCHANT_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- No row for a given (MERCHANT_ID, METHOD) means "not configured / not
-- enabled" — application code must treat a missing row the same as
-- ENABLED = 0, never assume a method is on by default.

-- CONFIGURATION INFRASTRUCTURE ONLY as of this migration — see the header
-- note above. Credentials are stored as one encrypted JSON payload
-- (CREDENTIALS_CIPHERTEXT/_IV/_AUTH_TAG, reusing the same AES-256-GCM helper
-- as MERCHANT_BANK_DETAILS.ACCOUNT_NUMBER — see
-- Backend/modules/encryption.module.js) rather than fixed columns like
-- API_KEY/API_SECRET, because different gateways may require entirely
-- different credential shapes and this project deliberately avoids
-- hardcoding one provider's shape (or which bank a provider is "allowed"
-- to pair with) into the schema — see CLAUDE.md §62 addendum.
CREATE TABLE MERCHANT_PAYMENT_ACCOUNTS (
  ID                        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  MERCHANT_ID               INT UNSIGNED NOT NULL,
  PROVIDER                  VARCHAR(30)  NOT NULL,        -- app-validated slug, e.g. 'BAIDURI_GATEWAY' — intentionally not a fixed enum of "supported" providers; see Backend/modules/merchantPayments.module.js
  PROVIDER_MERCHANT_ID      VARCHAR(150) NULL,            -- the merchant's account/merchant ID with that provider — not a secret, safe to return to the merchant's own OWNER
  STATUS                    VARCHAR(20)  NOT NULL DEFAULT 'NOT_CONFIGURED', -- NOT_CONFIGURED | PENDING | ACTIVE | DISABLED | ERROR — application code may only ever write NOT_CONFIGURED/PENDING/DISABLED/ERROR today; ACTIVE is reserved for once real per-merchant charge routing exists and is verified (do not set it to imply working online settlement prematurely)
  CREDENTIALS_CIPHERTEXT    VARBINARY(4096) NULL,          -- AES-256-GCM ciphertext of a provider-specific JSON credential payload — never returned by any API response
  CREDENTIALS_IV            VARBINARY(16)   NULL,
  CREDENTIALS_AUTH_TAG      VARBINARY(16)   NULL,
  CREATED_AT                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_MERCHANT_PAYMENT_ACCOUNTS_MERCHANT
    FOREIGN KEY (MERCHANT_ID) REFERENCES MERCHANTS(ID) ON DELETE CASCADE,
  UNIQUE KEY UQ_MERCHANT_PAYMENT_ACCOUNTS_MERCHANT_PROVIDER (MERCHANT_ID, PROVIDER),
  INDEX IDX_MERCHANT_PAYMENT_ACCOUNTS_MERCHANT (MERCHANT_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PROVISIONED, NOT YET WRITTEN TO — see the header note above. One row per
-- MERCHANT_ORDER's payment (not per ORDERS row), because a marketplace
-- order's merchants can each be in a different payment state at the same
-- time (e.g. Merchant A already paid by bank transfer while Merchant B is
-- still awaiting theirs). ORDERS.STATUS/PAYMENT_STATUS remain the
-- customer-facing aggregate and only move PENDING_PAYMENT -> PAID (through
-- orderStateMachine.module.js, never bypassed) once every required
-- MERCHANT_ORDER_PAYMENTS row for that order is settled.
CREATE TABLE MERCHANT_ORDER_PAYMENTS (
  ID                              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  MERCHANT_ORDER_ID               INT UNSIGNED NOT NULL,
  PAYMENT_METHOD                  VARCHAR(20)  NOT NULL,   -- BANK_TRANSFER | ONLINE_PAYMENT | PAY_ON_DELIVERY | PAY_ON_PICKUP — see Backend/modules/merchantPayments.module.js. Only BANK_TRANSFER ever populates the SNAPSHOT_* bank columns below; PAY_ON_DELIVERY/PAY_ON_PICKUP leave them NULL (no bank account involved — see isOfflinePaymentMethod()).
  STATUS                          VARCHAR(20)  NOT NULL DEFAULT 'PENDING', -- PENDING | AWAITING_TRANSFER | PROCESSING | PAID | FAILED | CANCELLED | REFUNDED — see Backend/modules/orderStateMachine.module.js MERCHANT_ORDER_PAYMENT_TRANSITIONS. PAY_ON_DELIVERY/PAY_ON_PICKUP rows are created directly as PENDING and the merchant confirms straight to PAID (no AWAITING_TRANSFER step, which is bank-transfer-specific).
  AMOUNT                          DECIMAL(10,2) NOT NULL,  -- this merchant's portion — matches MERCHANT_ORDERS.MERCHANT_NET_AMOUNT context at creation time, not necessarily equal to it (commission handling is a MERCHANT_ORDERS concern, not this table's)
  CURRENCY                        CHAR(3) NOT NULL DEFAULT 'BND',
  BANK_DETAIL_ID                  INT UNSIGNED NULL,       -- informational pointer to the MERCHANT_BANK_DETAILS row used, if any — NOT authoritative for display; see SNAPSHOT_* columns below
  SNAPSHOT_BANK_NAME               VARCHAR(150) NULL,
  SNAPSHOT_BANK_OTHER_LABEL        VARCHAR(100) NULL,
  SNAPSHOT_DISPLAY_NAME            VARCHAR(150) NULL,
  SNAPSHOT_ACCOUNT_NAME            VARCHAR(150) NULL,
  SNAPSHOT_ACCOUNT_NUMBER_CIPHERTEXT VARBINARY(255) NULL,  -- independently re-encrypted at snapshot time (own IV/tag) — NOT a copy of MERCHANT_BANK_DETAILS' ciphertext/IV pair, so this row stays decryptable even if the source bank-details row is later deleted
  SNAPSHOT_ACCOUNT_NUMBER_IV         VARBINARY(16)  NULL,
  SNAPSHOT_ACCOUNT_NUMBER_AUTH_TAG   VARBINARY(16)  NULL,
  SNAPSHOT_ACCOUNT_NUMBER_LAST4      CHAR(4)        NULL,
  PROVIDER_ACCOUNT_ID              INT UNSIGNED NULL,       -- informational pointer to MERCHANT_PAYMENT_ACCOUNTS, if PAYMENT_METHOD = ONLINE_PAYMENT
  REFERENCE                       VARCHAR(100) NULL,        -- e.g. a bank transfer reference the customer was asked to quote
  CONFIRMED_AT                    TIMESTAMP NULL,
  CONFIRMED_BY_USER_ID             INT UNSIGNED NULL,
  CREATED_AT                      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT                      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_MERCHANT_ORDER_PAYMENTS_MERCHANT_ORDER
    FOREIGN KEY (MERCHANT_ORDER_ID) REFERENCES MERCHANT_ORDERS(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_MERCHANT_ORDER_PAYMENTS_BANK_DETAIL
    FOREIGN KEY (BANK_DETAIL_ID) REFERENCES MERCHANT_BANK_DETAILS(ID) ON DELETE SET NULL,
  CONSTRAINT FK_MERCHANT_ORDER_PAYMENTS_PROVIDER_ACCOUNT
    FOREIGN KEY (PROVIDER_ACCOUNT_ID) REFERENCES MERCHANT_PAYMENT_ACCOUNTS(ID) ON DELETE SET NULL,
  CONSTRAINT FK_MERCHANT_ORDER_PAYMENTS_CONFIRMED_BY
    FOREIGN KEY (CONFIRMED_BY_USER_ID) REFERENCES USERS(ID) ON DELETE SET NULL,
  UNIQUE KEY UQ_MERCHANT_ORDER_PAYMENTS_MERCHANT_ORDER (MERCHANT_ORDER_ID), -- one payment record per merchant order for now — matches SHIPMENTS' same one-per-merchant-order simplification in 005_orders_checkout.sql
  INDEX IDX_MERCHANT_ORDER_PAYMENTS_STATUS (STATUS)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
