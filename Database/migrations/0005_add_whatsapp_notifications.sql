-- ================================================================
-- Migration 0005 — WhatsApp Merchant Notifications
-- ================================================================
-- Adds opt-in WhatsApp order-notification configuration to MERCHANTS and
-- a new outbound-delivery tracking table, per the WhatsApp Merchant
-- Notification architecture audit (2026-09-16). Purely additive:
--
--   1. MERCHANTS gains two nullable/defaulted columns: WHATSAPP_PHONE
--      (E.164, nullable) and WHATSAPP_NOTIFICATIONS_ENABLED (defaults to
--      0 — opt-in only, no existing merchant is silently enrolled).
--   2. One new table: OUTBOUND_NOTIFICATIONS — see
--      schema/011_notifications.sql for full column-level rationale
--      (this migration's DDL mirrors it exactly).
--
-- Idempotent: guarded with information_schema checks, safe to re-run.
-- A fresh install via Database/All.sql already includes all of this
-- directly — this migration is only for an existing, already-live
-- database.
-- ================================================================

-- Select your NanashiCollectibles/GamerTavern database before running this script.
-- USE `your_gamertavern_schema`;


-- ================================================================
-- 1. MERCHANTS — new columns
-- ================================================================
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MERCHANTS'
     AND COLUMN_NAME = 'WHATSAPP_NOTIFICATIONS_ENABLED'
);

SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE MERCHANTS
     ADD COLUMN WHATSAPP_PHONE                 VARCHAR(20) NULL AFTER SOCIAL_LINKS,
     ADD COLUMN WHATSAPP_NOTIFICATIONS_ENABLED  TINYINT(1)  NOT NULL DEFAULT 0 AFTER WHATSAPP_PHONE',
  'SELECT ''MERCHANTS already has WHATSAPP_PHONE/WHATSAPP_NOTIFICATIONS_ENABLED — skipped'' AS notice'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ================================================================
-- 2. OUTBOUND_NOTIFICATIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS OUTBOUND_NOTIFICATIONS (
  ID                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  MERCHANT_ID           INT UNSIGNED NOT NULL,
  MERCHANT_ORDER_ID     INT UNSIGNED NULL,
  CHANNEL               VARCHAR(20)  NOT NULL,
  TYPE                  VARCHAR(50)  NOT NULL,
  DESTINATION           VARCHAR(30)  NOT NULL,
  STATUS                VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
  PROVIDER_MESSAGE_ID   VARCHAR(150) NULL,
  ATTEMPTS              INT UNSIGNED NOT NULL DEFAULT 0,
  LAST_ERROR            VARCHAR(500) NULL,
  SENT_AT               TIMESTAMP NULL,
  CREATED_AT            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_OUTBOUND_NOTIFICATIONS_MERCHANT
    FOREIGN KEY (MERCHANT_ID) REFERENCES MERCHANTS(ID) ON DELETE CASCADE,
  CONSTRAINT FK_OUTBOUND_NOTIFICATIONS_MERCHANT_ORDER
    FOREIGN KEY (MERCHANT_ORDER_ID) REFERENCES MERCHANT_ORDERS(ID) ON DELETE CASCADE,
  UNIQUE KEY UQ_OUTBOUND_NOTIFICATIONS_ORDER_CHANNEL_TYPE (MERCHANT_ORDER_ID, CHANNEL, TYPE),
  INDEX IDX_OUTBOUND_NOTIFICATIONS_MERCHANT (MERCHANT_ID),
  INDEX IDX_OUTBOUND_NOTIFICATIONS_STATUS (STATUS)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ================================================================
-- END OF Migration 0005
-- 1 new table, 2 new columns on an existing table (one defaulted to 0,
-- opt-in). No destructive statements. No merchant is notified unless they
-- explicitly enable it and configure a WhatsApp number.
-- ================================================================
