-- ================================================================
-- NanashiCollectibles Marketplace Migration 2 — Hardening
-- ================================================================
-- Additive follow-up to Database/Marketplace_Migration.sql, produced
-- during the Phase 1.5 hardening/verification pass. Run AFTER both
-- Database/NanashiCollectibles_v2.sql and Database/Marketplace_Migration.sql.
--
-- This script does NOT drop, rename, or destructively alter anything.
-- Every change is either a new table or a widening/additive ALTER.
--
-- Audit result from reviewing NanashiCollectibles_v2.sql +
-- Marketplace_Migration.sql against this pass's checklist (duplicate
-- tables, conflicting FKs, FK creation order, column type mismatches,
-- missing indexes on FK columns, UNIQUE constraints, ON DELETE intent,
-- DECIMAL usage): NO STRUCTURAL BUGS FOUND. Every FK column's type
-- matches its referenced primary key exactly (INT UNSIGNED throughout),
-- every table is created after everything it references, every monetary
-- column already uses DECIMAL, and MySQL auto-creates an index for any
-- FK column that doesn't already have an explicit one — so no FK column
-- in either prior file is actually unindexed at the storage engine level.
-- The changes below are new capability (idempotency, encrypted bank
-- details), not corrections to a defect in the prior two files.
-- ================================================================

-- Select your NanashiCollectibles database before running this script.
-- USE `your_nanashicollectibles_schema`;


-- ================================================================
-- SECTION 1 — CHECKOUT IDEMPOTENCY
-- ================================================================
-- Backs Backend/routes/api/checkout.routes.js. The UNIQUE key on
-- (user_id, idempotency_key) is what makes a duplicate checkout attempt
-- fail fast at the database level, even under real concurrency, before
-- any reservation/payment logic runs a second time.

CREATE TABLE checkout_idempotency (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          INT UNSIGNED NOT NULL,
  idempotency_key  VARCHAR(100) NOT NULL,
  request_hash     CHAR(64)     NOT NULL,             -- sha256 of the normalized request payload
  status           VARCHAR(20)  NOT NULL DEFAULT 'PROCESSING', -- PROCESSING | COMPLETED | FAILED
  order_id         INT UNSIGNED NULL,
  response_json    LONGTEXT NULL,                       -- the exact { httpStatus, body } to replay on a retry
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at       TIMESTAMP NOT NULL,
  CONSTRAINT fk_checkout_idempotency_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_checkout_idempotency_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  UNIQUE KEY uq_checkout_idempotency_user_key (user_id, idempotency_key),
  INDEX idx_checkout_idempotency_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- expires_at exists for a future cleanup job (DELETE FROM checkout_idempotency
-- WHERE expires_at < NOW()) — no such job is implemented yet; rows are
-- harmless to leave in place until one exists.


-- ================================================================
-- SECTION 2 — ENCRYPTED MERCHANT BANK DETAILS
-- ================================================================
-- Replaces the plaintext account_number column from
-- Marketplace_Migration.sql SECTION 1 with AES-256-GCM ciphertext +
-- per-row IV + auth tag (see Backend/modules/encryption.module.js), plus
-- a last4 column so the API can show "****1234" without ever decrypting
-- for a list view. The original account_number column is kept (nullable)
-- for backward compatibility with any row inserted before this script —
-- application code no longer reads or writes it going forward.

ALTER TABLE merchant_bank_details
  MODIFY COLUMN account_number VARCHAR(50) NULL,       -- deprecated plaintext column; no longer written to by the application
  ADD COLUMN account_number_ciphertext VARBINARY(255) NULL AFTER account_number,
  ADD COLUMN account_number_iv         VARBINARY(16)  NULL AFTER account_number_ciphertext,
  ADD COLUMN account_number_auth_tag   VARBINARY(16)  NULL AFTER account_number_iv,
  ADD COLUMN account_number_last4      CHAR(4)        NULL AFTER account_number_auth_tag;
-- BACKEND REQUIREMENT: every new/updated bank_details row must populate
-- account_number_ciphertext/iv/auth_tag/last4 via
-- Backend/modules/encryption.module.js and MUST NOT populate the
-- deprecated account_number column. API responses must only ever return
-- account_number_last4, never the ciphertext columns or a decrypted value,
-- except where a specific, explicitly-authorized admin/payout-processing
-- action genuinely needs the real number (not implemented in this pass).


-- ================================================================
-- END OF Marketplace Migration 2 — Hardening
-- 1 new table, 1 additively-altered existing table
-- (merchant_bank_details). No destructive statements, nothing executed.
-- ================================================================
