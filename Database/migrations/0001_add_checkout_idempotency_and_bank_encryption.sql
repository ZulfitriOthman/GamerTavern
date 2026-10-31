-- ================================================================
-- Migration 0001 — Add CHECKOUT_IDEMPOTENCY + MERCHANT_BANK_DETAILS encryption columns
-- ================================================================
-- Fixes confirmed live schema drift found during the GamerTavern database
-- audit (2026-09-14): Database/Marketplace_Migration_2_Hardening.sql was
-- written but never actually applied to the live database, even though
-- application CODE already depends on both changes:
--
--   1. Backend/routes/api/checkout.routes.js reads/writes
--      `CHECKOUT_IDEMPOTENCY` on every checkout request. The table did not
--      exist live, so every real checkout attempt was failing with a SQL
--      "table doesn't exist" error.
--   2. Backend/routes/api/merchant.routes.js's
--      POST /api/merchant/settings/bank-details writes to
--      ACCOUNT_NUMBER_CIPHERTEXT/_iv/_auth_tag/_last4 on
--      `MERCHANT_BANK_DETAILS`. Those columns did not exist live, so any
--      attempt to save merchant bank details was failing the same way.
--
-- This migration is PURELY ADDITIVE: one new table, four new nullable
-- columns on an existing table. Nothing is dropped, renamed, or
-- destructively altered. MERCHANT_BANK_DETAILS.ACCOUNT_NUMBER (the
-- deprecated plaintext column) is intentionally left in place — see the
-- NOTE at the end of this file. At the time this migration was written,
-- MERCHANT_BANK_DETAILS had 0 rows and CHECKOUT_IDEMPOTENCY did not exist,
-- so there is no data migration/backfill concern.
--
-- Originally applied against the shared `nanashi_barber82street` database
-- (2026-09-14). GamerTavern has since moved to its own dedicated database
-- (`nanashi_collectibles`, 2026-09-14/15) — a fresh install of that database
-- via Database/All.sql already includes CHECKOUT_IDEMPOTENCY and the
-- MERCHANT_BANK_DETAILS encryption columns directly (see
-- schema/004_merchants.sql and schema/005_orders_checkout.sql), so this
-- migration is NOT needed there. It's kept here only for any OTHER
-- environment that still has an older, pre-hardening database shape.
-- Touches only `CHECKOUT_IDEMPOTENCY` (new) and `MERCHANT_BANK_DETAILS`
-- (existing GamerTavern table) — no other table is affected.
--
-- Idempotent: uses IF NOT EXISTS / information_schema guards so it is
-- safe to re-run without error if partially applied.
-- ================================================================

-- Select your NanashiCollectibles/GamerTavern database before running this script.
-- USE `your_gamertavern_schema`;


-- ================================================================
-- 1. CHECKOUT IDEMPOTENCY
-- ================================================================
CREATE TABLE IF NOT EXISTS CHECKOUT_IDEMPOTENCY (
  ID               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  USER_ID          INT UNSIGNED NOT NULL,
  IDEMPOTENCY_KEY  VARCHAR(100) NOT NULL,
  REQUEST_HASH     CHAR(64)     NOT NULL,             -- sha256 of the normalized request payload
  STATUS           VARCHAR(20)  NOT NULL DEFAULT 'PROCESSING', -- PROCESSING | COMPLETED | FAILED
  ORDER_ID         INT UNSIGNED NULL,
  RESPONSE_JSON    LONGTEXT NULL,                       -- the exact { httpStatus, BODY } to replay on a retry
  CREATED_AT       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  EXPIRES_AT       TIMESTAMP NOT NULL,
  CONSTRAINT FK_CHECKOUT_IDEMPOTENCY_USER
    FOREIGN KEY (USER_ID) REFERENCES USERS(ID) ON DELETE CASCADE,
  CONSTRAINT FK_CHECKOUT_IDEMPOTENCY_ORDER
    FOREIGN KEY (ORDER_ID) REFERENCES ORDERS(ID) ON DELETE SET NULL,
  UNIQUE KEY UQ_CHECKOUT_IDEMPOTENCY_USER_KEY (USER_ID, IDEMPOTENCY_KEY),
  INDEX IDX_CHECKOUT_IDEMPOTENCY_EXPIRES (EXPIRES_AT)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ================================================================
-- 2. ENCRYPTED MERCHANT BANK DETAILS
-- ================================================================
-- Adds encrypted-at-rest columns (AES-256-GCM, see
-- Backend/modules/encryption.module.js) alongside the existing plaintext
-- `ACCOUNT_NUMBER` column. `ACCOUNT_NUMBER` is NOT dropped in this
-- migration — see the NOTE below. Guarded with information_schema checks
-- so this is safe to re-run.

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MERCHANT_BANK_DETAILS'
     AND COLUMN_NAME = 'ACCOUNT_NUMBER_CIPHERTEXT'
);

SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE MERCHANT_BANK_DETAILS
     MODIFY COLUMN ACCOUNT_NUMBER VARCHAR(50) NULL,
     ADD COLUMN ACCOUNT_NUMBER_CIPHERTEXT VARBINARY(255) NULL AFTER ACCOUNT_NUMBER,
     ADD COLUMN ACCOUNT_NUMBER_IV         VARBINARY(16)  NULL AFTER ACCOUNT_NUMBER_CIPHERTEXT,
     ADD COLUMN ACCOUNT_NUMBER_AUTH_TAG   VARBINARY(16)  NULL AFTER ACCOUNT_NUMBER_IV,
     ADD COLUMN ACCOUNT_NUMBER_LAST4      CHAR(4)        NULL AFTER ACCOUNT_NUMBER_AUTH_TAG',
  'SELECT ''MERCHANT_BANK_DETAILS already has encryption columns — skipped'' AS notice'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- BACKEND REQUIREMENT (already implemented in Backend/routes/api/merchant.routes.js
-- as of this migration): every new/updated bank_details row must populate
-- ACCOUNT_NUMBER_CIPHERTEXT/iv/auth_tag/last4 and MUST NOT populate the
-- deprecated ACCOUNT_NUMBER column going forward.
--
-- NOT DONE IN THIS MIGRATION, BY DESIGN (see conversation decision
-- 2026-09-14): dropping the plaintext `ACCOUNT_NUMBER` column. It stays,
-- nullable, until the application has been verified end-to-end with the
-- encrypted columns and any backfill/migration strategy for legacy rows
-- (there are currently none — the table has 0 rows) has been separately
-- decided. Do not drop it as part of a future "cleanup" without a
-- dedicated decision to do so.


-- ================================================================
-- END OF Migration 0001
-- 1 new table (CHECKOUT_IDEMPOTENCY), 1 additively-altered existing table
-- (MERCHANT_BANK_DETAILS). No destructive statements.
-- ================================================================
