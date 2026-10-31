-- ================================================================
-- Migration 0007 — Customer delivery checkout (address line 2, delivery
-- instructions, optional reference photo)
-- ================================================================
-- Makes fulfilment a real, interactive part of checkout: a Delivery order
-- now carries a real address (reusing CUSTOMER_ADDRESSES, extended with one
-- new nullable column), free-text delivery instructions, and an optional
-- one-per-order reference photo. See Database/README.md "Customer Delivery
-- Checkout" for full rationale. Purely additive:
--
--   1. CUSTOMER_ADDRESSES gains ADDRESS_LINE2 (nullable).
--   2. ORDERS gains DELIVERY_INSTRUCTIONS (nullable).
--   3. New table ORDER_DELIVERY_ATTACHMENTS (one row per order, at most).
--
-- Idempotent: guarded with information_schema checks, safe to re-run.
-- A fresh install via Database/All.sql already includes all of this
-- directly — this migration is only for an existing, already-live database.
--
-- NOT DONE HERE, BY DESIGN: no data backfill needed — new columns are
-- nullable and existing ORDERS/CUSTOMER_ADDRESSES rows are valid as-is.
-- ================================================================

-- Select your NanashiCollectibles/GamerTavern database before running this script.
-- USE `your_gamertavern_schema`;


-- ================================================================
-- 1. CUSTOMER_ADDRESSES.ADDRESS_LINE2
-- ================================================================
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CUSTOMER_ADDRESSES'
     AND COLUMN_NAME = 'ADDRESS_LINE2'
);

SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE CUSTOMER_ADDRESSES ADD COLUMN ADDRESS_LINE2 VARCHAR(255) NULL AFTER ADDRESS_LINE1',
  'SELECT ''CUSTOMER_ADDRESSES already has ADDRESS_LINE2 — skipped'' AS notice'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ================================================================
-- 2. ORDERS.DELIVERY_INSTRUCTIONS
-- ================================================================
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ORDERS'
     AND COLUMN_NAME = 'DELIVERY_INSTRUCTIONS'
);

SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE ORDERS ADD COLUMN DELIVERY_INSTRUCTIONS VARCHAR(500) NULL AFTER COUPON_ID',
  'SELECT ''ORDERS already has DELIVERY_INSTRUCTIONS — skipped'' AS notice'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ================================================================
-- 3. ORDER_DELIVERY_ATTACHMENTS
-- ================================================================
CREATE TABLE IF NOT EXISTS ORDER_DELIVERY_ATTACHMENTS (
  ID           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ORDER_ID     INT UNSIGNED NOT NULL,
  FILE_URL     VARCHAR(255) NOT NULL,
  FILE_TYPE    VARCHAR(30)  NOT NULL,
  CREATED_AT   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_ORDER_DELIVERY_ATTACHMENTS_ORDER
    FOREIGN KEY (ORDER_ID) REFERENCES ORDERS(ID) ON DELETE CASCADE,
  UNIQUE KEY UQ_ORDER_DELIVERY_ATTACHMENTS_ORDER (ORDER_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ================================================================
-- END OF Migration 0007
-- 1 new table, 2 new nullable columns on existing tables. No destructive
-- statements.
-- ================================================================
