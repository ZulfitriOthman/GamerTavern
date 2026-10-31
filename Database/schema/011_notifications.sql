-- ================================================================
-- 011 — OUTBOUND NOTIFICATIONS (WhatsApp Merchant Notifications)
-- ================================================================
-- Added 2026-09-16. Outbound, external-channel delivery tracking for
-- transactional merchant notifications (WhatsApp first; CHANNEL is
-- app-validated and deliberately not constrained to WhatsApp only, so
-- EMAIL/SMS could reuse this same table later without a redesign).
--
-- This is NOT the same thing as the existing `NOTIFICATIONS` table
-- (schema/008_platform_ops.sql) — that one is an in-app, USER_ID-scoped
-- read/unread inbox (TITLE/BODY/IS_READ) with zero delivery-channel
-- concept and zero backend consumers as of this audit. Overloading it for
-- outbound WhatsApp delivery (which needs a destination address, a
-- provider message id, retry/attempt tracking, and per-order idempotency)
-- would conflate two genuinely different concerns — same reasoning as why
-- MERCHANT_ORDER_PAYMENTS is its own table rather than more columns on
-- MERCHANT_ORDERS. NOTIFICATIONS is untouched by this migration.
--
-- Idempotency: UNIQUE(MERCHANT_ORDER_ID, CHANNEL, TYPE) — a retried
-- checkout (already deduped by CHECKOUT_IDEMPOTENCY) or any other retry
-- path can attempt to queue the same notification any number of times;
-- only the first INSERT succeeds, every subsequent attempt fails with a
-- duplicate-key error that application code treats as "already
-- queued/sent, skip" rather than sending a second WhatsApp message. See
-- Backend/services/notifications/NotificationService.js.
CREATE TABLE OUTBOUND_NOTIFICATIONS (
  ID                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  MERCHANT_ID           INT UNSIGNED NOT NULL,
  MERCHANT_ORDER_ID     INT UNSIGNED NULL,               -- nullable: order-scoped types set this; future non-order types (e.g. LOW_STOCK) may not
  CHANNEL               VARCHAR(20)  NOT NULL,           -- app-validated: WHATSAPP for now
  TYPE                  VARCHAR(50)  NOT NULL,           -- app-validated: NEW_ORDER for now (future: PAYMENT_RECEIVED | ORDER_CANCELLED | LOW_STOCK | DISPUTE_OPENED | PAYOUT_PROCESSED)
  DESTINATION           VARCHAR(30)  NOT NULL,           -- E.164 phone at send time (snapshotted — a merchant changing their number later must not retroactively change what an already-sent notification's record shows)
  STATUS                VARCHAR(20)  NOT NULL DEFAULT 'PENDING', -- PENDING | SENT | FAILED | SKIPPED
  PROVIDER_MESSAGE_ID   VARCHAR(150) NULL,
  ATTEMPTS              INT UNSIGNED NOT NULL DEFAULT 0,
  LAST_ERROR            VARCHAR(500) NULL,                -- sanitized only — provider message/code, never a raw request/response body or any secret (see WhatsAppCloudProvider.js)
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
-- MySQL treats NULL as distinct in a UNIQUE index, so the
-- (MERCHANT_ORDER_ID, CHANNEL, TYPE) uniqueness only ever actually blocks
-- duplicates for order-scoped types (MERCHANT_ORDER_ID NOT NULL) — exactly
-- the case that matters today. A future non-order type with
-- MERCHANT_ORDER_ID = NULL would need its own idempotency key if one is
-- ever added; not needed for NEW_ORDER.
