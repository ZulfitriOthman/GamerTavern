-- ================================================================
-- 004 — MERCHANTS
-- ================================================================
-- A "merchant" is a business profile layered on top of the existing
-- USERS/JWT auth system — it does NOT introduce a parallel auth
-- system. Merchant staff authenticate through the same
-- POST /api/auth/login as everyone else. MERCHANT_USERS links an
-- existing USERS row to a merchant with a ROLE. Identity for "which
-- merchant is this request acting on behalf of" must always be
-- resolved server-side from MERCHANT_USERS for the authenticated
-- user — never accepted from the client.
-- ================================================================

-- PRODUCTS.MERCHANT_ID genuinely depends on this file's `MERCHANTS`
-- table, so it's added here rather than in 003_catalog.sql — see the
-- NOTE at the top of that file. Nullable and additive: a product with
-- MERCHANT_ID = NULL is a standalone vendor's product, scoped by
-- VENDOR_ID instead (dual-scoping model, both paths are live).
ALTER TABLE PRODUCTS
  ADD COLUMN MERCHANT_ID INT UNSIGNED NULL AFTER VENDOR_ID;

-- WHATSAPP_PHONE / WHATSAPP_NOTIFICATIONS_ENABLED added in migrations/0005
-- (WhatsApp Merchant Notifications, 2026-09-16) — see
-- Backend/services/notifications/. Deliberately separate from PHONE: PHONE
-- is general contact info (not necessarily E.164, not opt-in); a merchant's
-- WhatsApp notification number must be explicitly configured, never assumed
-- to be their login/contact phone. ENABLED defaults to 0 — opt-in only,
-- never on by default for existing or new merchants.
CREATE TABLE MERCHANTS (
  ID                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  BUSINESS_NAME       VARCHAR(150) NOT NULL,
  DISPLAY_NAME        VARCHAR(150) NOT NULL,
  SLUG                VARCHAR(180) NOT NULL,
  CONTACT_PERSON      VARCHAR(100) NOT NULL,
  EMAIL               VARCHAR(100) NOT NULL,
  PHONE               VARCHAR(20)  NULL,
  BUSINESS_CATEGORY   VARCHAR(50)  NULL,               -- e.g. 'tcg' | 'collectibles' | 'gunpla' | 'drone' | 'computer_parts' | 'general' — app-validated
  STATUS              VARCHAR(20)  NOT NULL DEFAULT 'PENDING', -- PENDING | ACTIVE | SUSPENDED | BANNED | REJECTED — see Database/README.md "Status conventions"
  COMMISSION_PERCENT  DECIMAL(5,2) NULL,                -- override; NULL = use PLATFORM_SETTINGS.platform_commission_percent
  SOCIAL_LINKS        TEXT NULL,                        -- JSON-encoded, app-validated
  WHATSAPP_PHONE                  VARCHAR(20)  NULL,     -- E.164 (e.g. +6738888888); distinct from PHONE, see note above
  WHATSAPP_NOTIFICATIONS_ENABLED  TINYINT(1)   NOT NULL DEFAULT 0,
  CREATED_AT          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY UQ_MERCHANTS_SLUG (SLUG),
  UNIQUE KEY UQ_MERCHANTS_EMAIL (EMAIL),
  INDEX IDX_MERCHANTS_STATUS (STATUS)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- New MERCHANTS default to PENDING and must not receive unrestricted
-- marketplace access until an admin sets STATUS = 'ACTIVE' (see
-- Backend/routes/api/admin.routes.js, Backend/modules/orderStateMachine.module.js
-- MERCHANT_TRANSITIONS: PENDING->ACTIVE, PENDING->REJECTED, REJECTED->ACTIVE,
-- ACTIVE->SUSPENDED, ACTIVE->BANNED, SUSPENDED->ACTIVE, SUSPENDED->BANNED,
-- BANNED->ACTIVE (an explicit, audited unban — never automatic)). SUSPENDED
-- keeps read-only dashboard access for the merchant's own staff
-- (Backend/modules/restAuth.module.js requireMerchant's
-- allowReadOnlyWhenSuspended); BANNED has none, not even read-only.

ALTER TABLE PRODUCTS
  ADD CONSTRAINT FK_PRODUCTS_MERCHANT
    FOREIGN KEY (MERCHANT_ID) REFERENCES MERCHANTS(ID) ON DELETE SET NULL,
  ADD INDEX IDX_PRODUCTS_MERCHANT (MERCHANT_ID);

CREATE TABLE MERCHANT_USERS (
  ID           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  MERCHANT_ID  INT UNSIGNED NOT NULL,
  USER_ID      INT UNSIGNED NOT NULL,
  ROLE         VARCHAR(20)  NOT NULL DEFAULT 'MERCHANT_OWNER', -- MERCHANT_OWNER | MERCHANT_ADMIN | MERCHANT_EMPLOYEE
  STATUS       VARCHAR(20)  NOT NULL DEFAULT 'active',         -- active | suspended | removed
  CREATED_AT   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_MERCHANT_USERS_MERCHANT
    FOREIGN KEY (MERCHANT_ID) REFERENCES MERCHANTS(ID) ON DELETE CASCADE,
  CONSTRAINT FK_MERCHANT_USERS_USER
    FOREIGN KEY (USER_ID) REFERENCES USERS(ID) ON DELETE CASCADE,
  UNIQUE KEY UQ_MERCHANT_USERS_MERCHANT_USER (MERCHANT_ID, USER_ID),
  INDEX IDX_MERCHANT_USERS_USER (USER_ID),
  INDEX IDX_MERCHANT_USERS_MERCHANT (MERCHANT_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE MERCHANT_ADDRESSES (
  ID            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  MERCHANT_ID   INT UNSIGNED NOT NULL,
  LABEL         VARCHAR(50)  NULL,                      -- e.g. 'Pickup Point', 'Warehouse'
  ADDRESS_LINE1 VARCHAR(255) NOT NULL,
  DISTRICT      VARCHAR(100) NULL,
  MUKIM         VARCHAR(100) NULL,
  VILLAGE       VARCHAR(100) NULL,
  POSTCODE      VARCHAR(20)  NULL,
  COUNTRY_CODE  CHAR(2)      NOT NULL DEFAULT 'BN',
  IS_DEFAULT    TINYINT(1)   NOT NULL DEFAULT 0,
  CREATED_AT    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_MERCHANT_ADDRESSES_MERCHANT
    FOREIGN KEY (MERCHANT_ID) REFERENCES MERCHANTS(ID) ON DELETE CASCADE,
  INDEX IDX_MERCHANT_ADDRESSES_MERCHANT (MERCHANT_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bank details: encrypted-at-rest columns are the current, live shape
-- (as of migrations/0001 applied 2026-09-14). `ACCOUNT_NUMBER` (plaintext)
-- is DEPRECATED and kept only for backward compatibility with rows
-- inserted before encryption existed — application CODE must never write
-- to it going forward, and it is intentionally NOT dropped here (no
-- destructive change bundled into this schema rewrite — see
-- Database/README.md). API responses must only ever return
-- ACCOUNT_NUMBER_LAST4, never the ciphertext columns or a decrypted VALUE.
--
-- DISPLAY_NAME / NOTES / BANK_OTHER_LABEL added in migrations/0004 (Merchant
-- Payments Stage 1, 2026-09-16) — see Backend/modules/merchantPayments.module.js
-- for the app-validated BANK_NAME vocabulary (BIBD | BAIDURI | TAIB | OTHER).
-- ACCOUNT_NAME is the legal/bank-registered account holder name; DISPLAY_NAME
-- is the customer-facing recognizable name (e.g. a merchant's storefront
-- name) shown at checkout — they are deliberately separate fields, since a
-- merchant's bank account is rarely opened under their storefront name.
-- This table is also, unchanged, the source for existing platform→merchant
-- payout details — see Database/README.md "Merchant Payments" for how the
-- two concerns (customer→merchant bank transfer vs. platform→merchant
-- payout) share this one secure account record without being conflated.
CREATE TABLE MERCHANT_BANK_DETAILS (
  ID                          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  MERCHANT_ID                 INT UNSIGNED NOT NULL,
  BANK_NAME                   VARCHAR(150) NOT NULL,      -- app-validated: BIBD | BAIDURI | TAIB | OTHER
  BANK_OTHER_LABEL            VARCHAR(100) NULL,           -- free-text label, only meaningful/used when BANK_NAME = 'OTHER'
  DISPLAY_NAME                VARCHAR(150) NULL,           -- customer-facing name shown at checkout; falls back to ACCOUNT_NAME in application code when NULL
  ACCOUNT_NAME                VARCHAR(150) NOT NULL,       -- legal/bank account holder name
  ACCOUNT_NUMBER              VARCHAR(50)  NULL,          -- DEPRECATED plaintext column — do not write to this
  ACCOUNT_NUMBER_CIPHERTEXT   VARBINARY(255) NULL,        -- AES-256-GCM ciphertext, see Backend/modules/encryption.module.js
  ACCOUNT_NUMBER_IV           VARBINARY(16)  NULL,
  ACCOUNT_NUMBER_AUTH_TAG     VARBINARY(16)  NULL,
  ACCOUNT_NUMBER_LAST4        CHAR(4)        NULL,        -- safe to return in API responses
  SWIFT_CODE                  VARCHAR(20)  NULL,
  CURRENCY                    CHAR(3)      NOT NULL DEFAULT 'BND',
  NOTES                       VARCHAR(255) NULL,
  IS_DEFAULT                  TINYINT(1)   NOT NULL DEFAULT 0,
  CREATED_AT                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_MERCHANT_BANK_DETAILS_MERCHANT
    FOREIGN KEY (MERCHANT_ID) REFERENCES MERCHANTS(ID) ON DELETE CASCADE,
  INDEX IDX_MERCHANT_BANK_DETAILS_MERCHANT (MERCHANT_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- One-default-per-merchant is an application-enforced invariant (unset the
-- previous default, then set the new one, inside one transaction — see
-- Backend/routes/api/merchant.routes.js), not a DB constraint — this schema
-- avoids partial-unique-index tricks per "Supported engine" in
-- Database/README.md (no CHECK constraints assumed available).
