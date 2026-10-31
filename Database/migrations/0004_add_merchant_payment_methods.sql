-- ================================================================
-- Migration 0004 — Merchant Payments Stage 1
-- ================================================================
-- Adds per-merchant payment-method configuration on top of the existing
-- MERCHANT_BANK_DETAILS table, per the Merchant Payments architecture audit
-- (2026-09-16). Purely additive:
--
--   1. MERCHANT_BANK_DETAILS gains three nullable columns: DISPLAY_NAME,
--      BANK_OTHER_LABEL, NOTES. No existing column is renamed, retyped, or
--      dropped — ACCOUNT_NAME/BANK_NAME/the encrypted account-number
--      columns/SWIFT_CODE/CURRENCY/IS_DEFAULT are unchanged.
--   2. Three new tables: MERCHANT_PAYMENT_METHODS, MERCHANT_PAYMENT_ACCOUNTS,
--      MERCHANT_ORDER_PAYMENTS — see schema/010_merchant_payments.sql for
--      full column-level rationale (this migration's DDL mirrors it exactly).
--
-- Idempotent: guarded with information_schema checks, safe to re-run.
-- A fresh install via Database/All.sql already includes all of this
-- directly — this migration is only for an existing, already-live database.
--
-- NOT DONE HERE, BY DESIGN: no data backfill. As of this migration,
-- MERCHANT_BANK_DETAILS' new columns are added NULL for every existing row
-- (DISPLAY_NAME falls back to ACCOUNT_NAME in application code when NULL,
-- per Backend/routes/api/merchant.routes.js) — nothing needs to be
-- backfilled for existing rows to keep working exactly as before.
--
-- Applied to the live `nanashi_collectibles` database on 2026-09-16 (manually,
-- by the project owner, against MERCHANT_BANK_DETAILS which at that point had
-- 0 rows — no data-loss/backfill concern), and structurally re-verified
-- afterward via information_schema: every column, FK, unique constraint,
-- engine, and collation below matches what was actually created live. This
-- exact SQL — in this exact order (MERCHANT_PAYMENT_METHODS, then
-- MERCHANT_PAYMENT_ACCOUNTS, then MERCHANT_ORDER_PAYMENTS) — is what
-- succeeded; MERCHANT_ORDER_PAYMENTS' FK to MERCHANT_PAYMENT_ACCOUNTS is why
-- the order matters (creating it first, before MERCHANT_PAYMENT_ACCOUNTS
-- exists, is the most likely cause of a prior errno 150 attempt against this
-- same design).
-- ================================================================

-- Select your NanashiCollectibles/GamerTavern database before running this script.
-- USE `your_gamertavern_schema`;


-- ================================================================
-- 1. MERCHANT_BANK_DETAILS — new nullable columns
-- ================================================================
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MERCHANT_BANK_DETAILS'
     AND COLUMN_NAME = 'DISPLAY_NAME'
);

SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE MERCHANT_BANK_DETAILS
     ADD COLUMN BANK_OTHER_LABEL VARCHAR(100) NULL AFTER BANK_NAME,
     ADD COLUMN DISPLAY_NAME     VARCHAR(150) NULL AFTER BANK_OTHER_LABEL,
     ADD COLUMN NOTES            VARCHAR(255) NULL AFTER CURRENCY',
  'SELECT ''MERCHANT_BANK_DETAILS already has DISPLAY_NAME/BANK_OTHER_LABEL/NOTES — skipped'' AS notice'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ================================================================
-- 2. MERCHANT_PAYMENT_METHODS
-- ================================================================
CREATE TABLE IF NOT EXISTS MERCHANT_PAYMENT_METHODS (
  ID           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  MERCHANT_ID  INT UNSIGNED NOT NULL,
  METHOD       VARCHAR(20)  NOT NULL,
  ENABLED      TINYINT(1)   NOT NULL DEFAULT 0,
  CREATED_AT   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_MERCHANT_PAYMENT_METHODS_MERCHANT
    FOREIGN KEY (MERCHANT_ID) REFERENCES MERCHANTS(ID) ON DELETE CASCADE,
  UNIQUE KEY UQ_MERCHANT_PAYMENT_METHODS_MERCHANT_METHOD (MERCHANT_ID, METHOD),
  INDEX IDX_MERCHANT_PAYMENT_METHODS_MERCHANT (MERCHANT_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ================================================================
-- 3. MERCHANT_PAYMENT_ACCOUNTS
-- ================================================================
CREATE TABLE IF NOT EXISTS MERCHANT_PAYMENT_ACCOUNTS (
  ID                        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  MERCHANT_ID               INT UNSIGNED NOT NULL,
  PROVIDER                  VARCHAR(30)  NOT NULL,
  PROVIDER_MERCHANT_ID      VARCHAR(150) NULL,
  STATUS                    VARCHAR(20)  NOT NULL DEFAULT 'NOT_CONFIGURED',
  CREDENTIALS_CIPHERTEXT    VARBINARY(4096) NULL,
  CREDENTIALS_IV            VARBINARY(16)   NULL,
  CREDENTIALS_AUTH_TAG      VARBINARY(16)   NULL,
  CREATED_AT                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_MERCHANT_PAYMENT_ACCOUNTS_MERCHANT
    FOREIGN KEY (MERCHANT_ID) REFERENCES MERCHANTS(ID) ON DELETE CASCADE,
  UNIQUE KEY UQ_MERCHANT_PAYMENT_ACCOUNTS_MERCHANT_PROVIDER (MERCHANT_ID, PROVIDER),
  INDEX IDX_MERCHANT_PAYMENT_ACCOUNTS_MERCHANT (MERCHANT_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ================================================================
-- 4. MERCHANT_ORDER_PAYMENTS
-- ================================================================
CREATE TABLE IF NOT EXISTS MERCHANT_ORDER_PAYMENTS (
  ID                                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  MERCHANT_ORDER_ID                  INT UNSIGNED NOT NULL,
  PAYMENT_METHOD                     VARCHAR(20)  NOT NULL,
  STATUS                             VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
  AMOUNT                             DECIMAL(10,2) NOT NULL,
  CURRENCY                           CHAR(3) NOT NULL DEFAULT 'BND',
  BANK_DETAIL_ID                     INT UNSIGNED NULL,
  SNAPSHOT_BANK_NAME                  VARCHAR(150) NULL,
  SNAPSHOT_BANK_OTHER_LABEL           VARCHAR(100) NULL,
  SNAPSHOT_DISPLAY_NAME               VARCHAR(150) NULL,
  SNAPSHOT_ACCOUNT_NAME               VARCHAR(150) NULL,
  SNAPSHOT_ACCOUNT_NUMBER_CIPHERTEXT  VARBINARY(255) NULL,
  SNAPSHOT_ACCOUNT_NUMBER_IV          VARBINARY(16)  NULL,
  SNAPSHOT_ACCOUNT_NUMBER_AUTH_TAG    VARBINARY(16)  NULL,
  SNAPSHOT_ACCOUNT_NUMBER_LAST4       CHAR(4)        NULL,
  PROVIDER_ACCOUNT_ID                 INT UNSIGNED NULL,
  REFERENCE                          VARCHAR(100) NULL,
  CONFIRMED_AT                       TIMESTAMP NULL,
  CONFIRMED_BY_USER_ID                INT UNSIGNED NULL,
  CREATED_AT                         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT                         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_MERCHANT_ORDER_PAYMENTS_MERCHANT_ORDER
    FOREIGN KEY (MERCHANT_ORDER_ID) REFERENCES MERCHANT_ORDERS(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_MERCHANT_ORDER_PAYMENTS_BANK_DETAIL
    FOREIGN KEY (BANK_DETAIL_ID) REFERENCES MERCHANT_BANK_DETAILS(ID) ON DELETE SET NULL,
  CONSTRAINT FK_MERCHANT_ORDER_PAYMENTS_PROVIDER_ACCOUNT
    FOREIGN KEY (PROVIDER_ACCOUNT_ID) REFERENCES MERCHANT_PAYMENT_ACCOUNTS(ID) ON DELETE SET NULL,
  CONSTRAINT FK_MERCHANT_ORDER_PAYMENTS_CONFIRMED_BY
    FOREIGN KEY (CONFIRMED_BY_USER_ID) REFERENCES USERS(ID) ON DELETE SET NULL,
  UNIQUE KEY UQ_MERCHANT_ORDER_PAYMENTS_MERCHANT_ORDER (MERCHANT_ORDER_ID),
  INDEX IDX_MERCHANT_ORDER_PAYMENTS_STATUS (STATUS)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ================================================================
-- END OF Migration 0004
-- 3 new tables, 3 new nullable columns on an existing table. No
-- destructive statements. No rows written to any new table by this
-- migration — merchants opt in through the Merchant Settings → Payments UI.
-- ================================================================
