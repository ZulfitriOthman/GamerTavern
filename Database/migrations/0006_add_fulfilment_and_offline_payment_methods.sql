-- ================================================================
-- Migration 0006 — Offline payment methods (Pay on Delivery / Pay on
-- Pickup) + per-merchant fulfilment methods
-- ================================================================
-- Adds a way for merchants to accept payment at delivery/pickup, and a way
-- for merchants to say which fulfilment methods (Delivery, Pickup) they
-- support in the first place — Nanashi is multi-merchant, so this is
-- deliberately per-merchant, not one global toggle. See
-- Database/schema/005_orders_checkout.sql (MERCHANT_FULFILMENT_METHODS) and
-- Database/schema/010_merchant_payments.sql (updated MERCHANT_PAYMENT_METHODS/
-- MERCHANT_ORDER_PAYMENTS comments) for full column-level rationale.
--
-- Purely additive:
--   1. MERCHANT_FULFILMENT_METHODS — new table (mirrors MERCHANT_PAYMENT_METHODS).
--   2. MERCHANT_PAYMENT_METHODS.METHOD and MERCHANT_ORDER_PAYMENTS.PAYMENT_METHOD
--      gain two new app-validated values — PAY_ON_DELIVERY, PAY_ON_PICKUP.
--      Both columns are already VARCHAR(20) with no CHECK constraint, so no
--      DDL is needed for this — application code
--      (Backend/modules/merchantPayments.module.js) is the only place the
--      allowed-values list lives. Nothing to run here for this part.
--
-- Idempotent: guarded with information_schema checks, safe to re-run.
-- A fresh install via Database/All.sql already includes all of this
-- directly — this migration is only for an existing, already-live database.
--
-- NOT DONE HERE, BY DESIGN: no data backfill, no merchant opted in
-- automatically. Existing rows in MERCHANT_PAYMENT_METHODS/MERCHANT_ORDER_PAYMENTS
-- are untouched. Merchants opt in to Pay on Delivery / Pay on Pickup and to
-- Delivery/Pickup fulfilment through the Merchant Settings -> Payments UI,
-- same as every other payment method so far.
-- ================================================================

-- Select your NanashiCollectibles/GamerTavern database before running this script.
-- USE `your_gamertavern_schema`;


-- ================================================================
-- 1. MERCHANT_FULFILMENT_METHODS
-- ================================================================
CREATE TABLE IF NOT EXISTS MERCHANT_FULFILMENT_METHODS (
  ID           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  MERCHANT_ID  INT UNSIGNED NOT NULL,
  METHOD       VARCHAR(20)  NOT NULL,
  ENABLED      TINYINT(1)   NOT NULL DEFAULT 0,
  CREATED_AT   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_MERCHANT_FULFILMENT_METHODS_MERCHANT
    FOREIGN KEY (MERCHANT_ID) REFERENCES MERCHANTS(ID) ON DELETE CASCADE,
  UNIQUE KEY UQ_MERCHANT_FULFILMENT_METHODS_MERCHANT_METHOD (MERCHANT_ID, METHOD),
  INDEX IDX_MERCHANT_FULFILMENT_METHODS_MERCHANT (MERCHANT_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ================================================================
-- 2. Reference seed: split the single "Pickup / Merchant Arranged"
--    SHIPPING_METHODS placeholder into two real, distinct methods, so
--    Delivery and Pickup become genuinely selectable at checkout.
--    Guarded: only runs if the old placeholder row is still the only one
--    present (a database that already has multiple SHIPPING_METHODS rows —
--    e.g. one seeded from Database/seeds/development.sql — is left alone).
-- ================================================================
SET @shipping_method_count := (SELECT COUNT(*) FROM SHIPPING_METHODS);
SET @placeholder_only := (
  SELECT COUNT(*) FROM SHIPPING_METHODS WHERE CODE = 'pickup' AND NAME = 'Pickup / Merchant Arranged'
);

-- Rename the placeholder row into a real "Pickup" method rather than
-- deleting/re-inserting it — preserves its ID, and any ORDERS row that
-- already references it keeps pointing at a sensible row.
UPDATE SHIPPING_METHODS
   SET NAME = 'Pickup', DESCRIPTION = 'Collect your order directly from the merchant.'
 WHERE CODE = 'pickup' AND NAME = 'Pickup / Merchant Arranged' AND @shipping_method_count = 1 AND @placeholder_only = 1;

INSERT INTO SHIPPING_METHODS (NAME, CODE, DESCRIPTION, BASE_FEE, STATUS)
SELECT 'Local Delivery', 'local_delivery', 'Delivery within Brunei-Muara and nearby districts.', 5.00, 'active'
 WHERE @shipping_method_count = 1 AND @placeholder_only = 1
   AND NOT EXISTS (SELECT 1 FROM SHIPPING_METHODS WHERE CODE = 'local_delivery');


-- ================================================================
-- END OF Migration 0006
-- 1 new table, 0 destructive statements. The SHIPPING_METHODS seed step
-- only ever renames the existing placeholder row and adds one new row —
-- it never deletes anything, and is a no-op on any database that has
-- already diverged from the single-placeholder-row reference seed.
-- ================================================================
