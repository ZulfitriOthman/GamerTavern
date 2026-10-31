-- ================================================================
-- Migration 0003 — Reconcile TICKET_HOLDS / TICKET_ORDERS with the
-- hold-session architecture (adds TICKET_HOLD_SESSIONS)
-- ================================================================
-- Context: migration 0002 (ticketing) was applied to the live database
-- from an EARLIER iteration of schema/009_ticketing.sql — the one before
-- the hold-session redesign. A live-database check on 2026-09-15 found:
--   - TICKET_HOLD_SESSIONS missing entirely
--   - TICKET_HOLDS still carrying its own USER_ID/EXPIRES_AT directly
--     (no HOLD_SESSION_ID), matching the pre-redesign shape
--   - TICKET_ORDERS missing the HOLD_SESSION_ID traceability column
-- All 12 present ticketing tables had 0 rows at inspection time, so this
-- migration is safe to run with no data migration/backfill step. A
-- schema-only backup was taken first: see
-- Database/backups/ticketing_schema_only_20260915_091211.sql
--
-- This brings the live schema in line with the current
-- schema/009_ticketing.sql. Every step is idempotent (guarded via an
-- information_schema check, same pattern as migration 0002's
-- forward-reference FKs) so this file is safe to re-run.
-- ================================================================

-- ================================================================
-- 1. CREATE TICKET_HOLD_SESSIONS (new table — additive)
-- ================================================================
CREATE TABLE IF NOT EXISTS TICKET_HOLD_SESSIONS (
  ID                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  EVENT_ID          INT UNSIGNED NOT NULL,
  USER_ID           INT UNSIGNED NOT NULL,
  IDEMPOTENCY_KEY   VARCHAR(100) NOT NULL,
  STATUS            VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  EXPIRES_AT        TIMESTAMP NOT NULL,
  CREATED_AT        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_TICKET_HOLD_SESSIONS_EVENT
    FOREIGN KEY (EVENT_ID) REFERENCES EVENTS(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_TICKET_HOLD_SESSIONS_USER
    FOREIGN KEY (USER_ID) REFERENCES USERS(ID) ON DELETE CASCADE,
  UNIQUE KEY UQ_TICKET_HOLD_SESSIONS_USER_KEY (USER_ID, IDEMPOTENCY_KEY),
  INDEX IDX_TICKET_HOLD_SESSIONS_EVENT_STATUS_EXPIRES (EVENT_ID, STATUS, EXPIRES_AT),
  INDEX IDX_TICKET_HOLD_SESSIONS_USER (USER_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 2. TICKET_HOLDS — drop USER_ID/EXPIRES_AT (now on the session),
--    add HOLD_SESSION_ID
-- ================================================================

-- 2a. Drop FK_TICKET_HOLDS_USER (must go before dropping its column/index)
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TICKET_HOLDS'
     AND CONSTRAINT_NAME = 'FK_TICKET_HOLDS_USER'
);
SET @ddl := IF(@fk_exists > 0,
  'ALTER TABLE TICKET_HOLDS DROP FOREIGN KEY FK_TICKET_HOLDS_USER',
  'SELECT ''FK_TICKET_HOLDS_USER already absent — skipped'' AS notice'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2b. Drop the now-orphaned IDX_TICKET_HOLDS_USER index
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TICKET_HOLDS'
     AND INDEX_NAME = 'IDX_TICKET_HOLDS_USER'
);
SET @ddl := IF(@idx_exists > 0,
  'ALTER TABLE TICKET_HOLDS DROP INDEX IDX_TICKET_HOLDS_USER',
  'SELECT ''IDX_TICKET_HOLDS_USER already absent — skipped'' AS notice'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2c. Drop USER_ID column (0 rows live at time of writing — no data loss)
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TICKET_HOLDS'
     AND COLUMN_NAME = 'USER_ID'
);
SET @ddl := IF(@col_exists > 0,
  'ALTER TABLE TICKET_HOLDS DROP COLUMN USER_ID',
  'SELECT ''TICKET_HOLDS.USER_ID already absent — skipped'' AS notice'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2d. Drop EXPIRES_AT column (moved to TICKET_HOLD_SESSIONS.EXPIRES_AT)
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TICKET_HOLDS'
     AND COLUMN_NAME = 'EXPIRES_AT'
);
SET @ddl := IF(@col_exists > 0,
  'ALTER TABLE TICKET_HOLDS DROP COLUMN EXPIRES_AT',
  'SELECT ''TICKET_HOLDS.EXPIRES_AT already absent — skipped'' AS notice'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2e. Add HOLD_SESSION_ID column (NOT NULL — safe because TICKET_HOLDS
--     has 0 rows to backfill at time of writing)
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TICKET_HOLDS'
     AND COLUMN_NAME = 'HOLD_SESSION_ID'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE TICKET_HOLDS ADD COLUMN HOLD_SESSION_ID INT UNSIGNED NOT NULL AFTER ID',
  'SELECT ''TICKET_HOLDS.HOLD_SESSION_ID already present — skipped'' AS notice'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2f. Add FK_TICKET_HOLDS_SESSION
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TICKET_HOLDS'
     AND CONSTRAINT_NAME = 'FK_TICKET_HOLDS_SESSION'
);
SET @ddl := IF(@fk_exists = 0,
  'ALTER TABLE TICKET_HOLDS
     ADD CONSTRAINT FK_TICKET_HOLDS_SESSION
       FOREIGN KEY (HOLD_SESSION_ID) REFERENCES TICKET_HOLD_SESSIONS(ID) ON DELETE CASCADE',
  'SELECT ''FK_TICKET_HOLDS_SESSION already present — skipped'' AS notice'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2g. Add IDX_TICKET_HOLDS_SESSION
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TICKET_HOLDS'
     AND INDEX_NAME = 'IDX_TICKET_HOLDS_SESSION'
);
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE TICKET_HOLDS ADD INDEX IDX_TICKET_HOLDS_SESSION (HOLD_SESSION_ID)',
  'SELECT ''IDX_TICKET_HOLDS_SESSION already present — skipped'' AS notice'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ================================================================
-- 3. TICKET_ORDERS — add HOLD_SESSION_ID (nullable, additive)
-- ================================================================
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TICKET_ORDERS'
     AND COLUMN_NAME = 'HOLD_SESSION_ID'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE TICKET_ORDERS ADD COLUMN HOLD_SESSION_ID INT UNSIGNED NULL AFTER USER_ID',
  'SELECT ''TICKET_ORDERS.HOLD_SESSION_ID already present — skipped'' AS notice'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TICKET_ORDERS'
     AND CONSTRAINT_NAME = 'FK_TICKET_ORDERS_HOLD_SESSION'
);
SET @ddl := IF(@fk_exists = 0,
  'ALTER TABLE TICKET_ORDERS
     ADD CONSTRAINT FK_TICKET_ORDERS_HOLD_SESSION
       FOREIGN KEY (HOLD_SESSION_ID) REFERENCES TICKET_HOLD_SESSIONS(ID) ON DELETE SET NULL',
  'SELECT ''FK_TICKET_ORDERS_HOLD_SESSION already present — skipped'' AS notice'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ================================================================
-- END OF Migration 0003
-- ================================================================
