-- ================================================================
-- 008 — PLATFORM OPS (payouts, settings, NOTIFICATIONS, audit log)
-- ================================================================
-- No automated fund transfer is implemented. Payouts are recorded here
-- by admin ACTION (manually today; no INSERT CODE path exists yet)
-- once a merchant_order is eligible.

CREATE TABLE MERCHANT_PAYOUTS (
  ID                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  MERCHANT_ID         INT UNSIGNED NOT NULL,
  PERIOD_START        DATE NOT NULL,
  PERIOD_END          DATE NOT NULL,
  GROSS_AMOUNT        DECIMAL(10,2) NOT NULL,
  COMMISSION_AMOUNT   DECIMAL(10,2) NOT NULL,
  NET_AMOUNT          DECIMAL(10,2) NOT NULL,
  STATUS              VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | ELIGIBLE | PROCESSING | PAID | FAILED | HELD
  PAID_AT             TIMESTAMP NULL,
  NOTES               TEXT NULL,
  CREATED_AT          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_MERCHANT_PAYOUTS_MERCHANT
    FOREIGN KEY (MERCHANT_ID) REFERENCES MERCHANTS(ID) ON DELETE RESTRICT,
  INDEX IDX_MERCHANT_PAYOUTS_MERCHANT (MERCHANT_ID),
  INDEX IDX_MERCHANT_PAYOUTS_STATUS (STATUS)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Read-only in the app today (GET /api/merchant/payouts) — no admin UI
-- creates a row here yet; not DORMANT like the tables below (it's actively
-- read), just missing its write path.

-- STATUS: DORMANT / RESERVED FOR PLANNED FEATURE — zero backend
-- references as of this audit (2026-09-14).
CREATE TABLE MERCHANT_PAYOUT_ITEMS (
  ID                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  MERCHANT_PAYOUT_ID   INT UNSIGNED NOT NULL,
  MERCHANT_ORDER_ID    INT UNSIGNED NOT NULL,
  AMOUNT               DECIMAL(10,2) NOT NULL,
  CREATED_AT           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_MERCHANT_PAYOUT_ITEMS_PAYOUT
    FOREIGN KEY (MERCHANT_PAYOUT_ID) REFERENCES MERCHANT_PAYOUTS(ID) ON DELETE CASCADE,
  CONSTRAINT FK_MERCHANT_PAYOUT_ITEMS_MERCHANT_ORDER
    FOREIGN KEY (MERCHANT_ORDER_ID) REFERENCES MERCHANT_ORDERS(ID) ON DELETE RESTRICT,
  UNIQUE KEY UQ_MERCHANT_PAYOUT_ITEMS_MERCHANT_ORDER (MERCHANT_ORDER_ID), -- a merchant_order can only ever be paid out once
  INDEX IDX_MERCHANT_PAYOUT_ITEMS_PAYOUT (MERCHANT_PAYOUT_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Added 2026-09-18 — commission Nanashi is owed BY the merchant, the
-- opposite direction from MERCHANT_PAYOUTS above (Nanashi owes merchant).
-- Only ever accrues for merchant orders paid DIRECTLY to the merchant
-- (Bank Transfer / Pay on Delivery / Pay on Pickup — i.e. a
-- MERCHANT_ORDER_PAYMENTS row exists and is PAID); an Online Payment
-- order never generates a receivable here, because Nanashi already
-- collected and can net the commission at payout time — see
-- Backend/modules/merchantFinance.module.js, the single place this rule
-- is encoded. A statement groups one merchant's unbilled commission for
-- a period into one payable amount with a due date; payments (partial
-- allowed) are recorded against it.
CREATE TABLE MERCHANT_COMMISSION_STATEMENTS (
  ID                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  MERCHANT_ID       INT UNSIGNED NOT NULL,
  PERIOD_START      DATE NOT NULL,
  PERIOD_END        DATE NOT NULL,
  ISSUE_DATE        DATE NOT NULL,
  DUE_DATE          DATE NOT NULL,
  GROSS_SALES       DECIMAL(10,2) NOT NULL DEFAULT 0,
  COMMISSION_AMOUNT DECIMAL(10,2) NOT NULL DEFAULT 0,
  AMOUNT_PAID       DECIMAL(10,2) NOT NULL DEFAULT 0,
  BALANCE_DUE       DECIMAL(10,2) NOT NULL DEFAULT 0,
  STATUS            VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- DRAFT | OPEN | PARTIALLY_PAID | PAID | OVERDUE | VOID — app only ever WRITES the first four plus VOID; OVERDUE is a derived, query-time condition (DUE_DATE < today AND BALANCE_DUE > 0), never a stored transition, since no scheduler exists to flip it
  CREATED_AT        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_MERCHANT_COMMISSION_STATEMENTS_MERCHANT
    FOREIGN KEY (MERCHANT_ID) REFERENCES MERCHANTS(ID) ON DELETE CASCADE,
  INDEX IDX_MCS_MERCHANT (MERCHANT_ID),
  INDEX IDX_MCS_STATUS (STATUS),
  INDEX IDX_MCS_DUE_DATE (DUE_DATE)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Proves exactly which merchant orders contributed to a statement's
-- totals. UQ_MCSI_MERCHANT_ORDER is the double-charge guard — a merchant
-- order can be billed on at most one statement ever, enforced at the
-- database level (mirrors MERCHANT_PAYOUT_ITEMS' identical pattern above).
CREATE TABLE MERCHANT_COMMISSION_STATEMENT_ITEMS (
  ID                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  STATEMENT_ID      INT UNSIGNED NOT NULL,
  MERCHANT_ORDER_ID INT UNSIGNED NOT NULL,
  GROSS_AMOUNT      DECIMAL(10,2) NOT NULL,
  COMMISSION_AMOUNT DECIMAL(10,2) NOT NULL,
  CREATED_AT        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_MCSI_STATEMENT
    FOREIGN KEY (STATEMENT_ID) REFERENCES MERCHANT_COMMISSION_STATEMENTS(ID) ON DELETE CASCADE,
  CONSTRAINT FK_MCSI_MERCHANT_ORDER
    FOREIGN KEY (MERCHANT_ORDER_ID) REFERENCES MERCHANT_ORDERS(ID) ON DELETE RESTRICT,
  UNIQUE KEY UQ_MCSI_MERCHANT_ORDER (MERCHANT_ORDER_ID),
  INDEX IDX_MCSI_STATEMENT (STATEMENT_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Records "merchant paid Nanashi" — supports partial payments; a
-- statement's AMOUNT_PAID/BALANCE_DUE/STATUS are recomputed from the SUM
-- of its payments whenever one is recorded (see admin.routes.js).
CREATE TABLE MERCHANT_COMMISSION_PAYMENTS (
  ID                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  MERCHANT_ID         INT UNSIGNED NOT NULL,
  STATEMENT_ID        INT UNSIGNED NOT NULL,
  AMOUNT              DECIMAL(10,2) NOT NULL,
  PAYMENT_METHOD      VARCHAR(30) NULL,
  REFERENCE           VARCHAR(100) NULL,
  PAID_AT             DATE NOT NULL,
  RECORDED_BY_USER_ID INT UNSIGNED NOT NULL,
  NOTES               VARCHAR(500) NULL,
  CREATED_AT          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_MCP_MERCHANT
    FOREIGN KEY (MERCHANT_ID) REFERENCES MERCHANTS(ID) ON DELETE CASCADE,
  CONSTRAINT FK_MCP_STATEMENT
    FOREIGN KEY (STATEMENT_ID) REFERENCES MERCHANT_COMMISSION_STATEMENTS(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_MCP_RECORDED_BY
    FOREIGN KEY (RECORDED_BY_USER_ID) REFERENCES USERS(ID) ON DELETE RESTRICT,
  INDEX IDX_MCP_MERCHANT (MERCHANT_ID),
  INDEX IDX_MCP_STATEMENT (STATEMENT_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE PLATFORM_SETTINGS (
  ID            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  SETTING_KEY   VARCHAR(100) NOT NULL,
  SETTING_VALUE VARCHAR(255) NOT NULL,
  DESCRIPTION   VARCHAR(255) NULL,
  UPDATED_AT    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY UQ_PLATFORM_SETTINGS_KEY (SETTING_KEY)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Required operational default — not sample/demo CONTENT. The backend's
-- commission calculation has no fallback if this row is missing, so it's
-- part of the schema, not a seed file.
INSERT INTO PLATFORM_SETTINGS (SETTING_KEY, SETTING_VALUE, DESCRIPTION) VALUES
  ('platform_commission_percent', '10.00', 'Default marketplace commission percentage applied to new merchant orders when a merchant has no commission_percent override.'),
  ('commission_due_days', '30', 'Days after a commission statement is issued before it becomes due (payment terms) — see MERCHANT_COMMISSION_STATEMENTS.');

-- STATUS: DORMANT / RESERVED FOR PLANNED FEATURE — zero backend
-- references, no creation path, as of this audit (2026-09-14).
CREATE TABLE NOTIFICATIONS (
  ID          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  USER_ID     INT UNSIGNED NOT NULL,
  TYPE        VARCHAR(50) NOT NULL,                       -- e.g. 'ORDER_PLACED', 'ORDER_SHIPPED', 'MERCHANT_APPROVED'
  TITLE       VARCHAR(150) NOT NULL,
  BODY        TEXT NULL,
  IS_READ     TINYINT(1) NOT NULL DEFAULT 0,
  CREATED_AT  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_NOTIFICATIONS_USER
    FOREIGN KEY (USER_ID) REFERENCES USERS(ID) ON DELETE CASCADE,
  INDEX IDX_NOTIFICATIONS_USER (USER_ID),
  INDEX IDX_NOTIFICATIONS_IS_READ (IS_READ)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE AUDIT_LOGS (
  ID                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ACTOR_USER_ID      INT UNSIGNED NULL,
  ACTOR_MERCHANT_ID  INT UNSIGNED NULL,
  ACTION             VARCHAR(100) NOT NULL,                -- e.g. 'PRODUCT_CREATED', 'STOCK_ADJUSTED', 'ORDER_STATUS_CHANGED', 'MERCHANT_STATUS_CHANGED'
  ENTITY_TYPE        VARCHAR(50) NOT NULL,
  ENTITY_ID          VARCHAR(50) NOT NULL,
  METADATA           LONGTEXT NULL,                        -- JSON-encoded, app-validated; never store secrets/PII beyond what's already elsewhere in this schema
  CREATED_AT         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_AUDIT_LOGS_ACTOR_USER
    FOREIGN KEY (ACTOR_USER_ID) REFERENCES USERS(ID) ON DELETE SET NULL,
  CONSTRAINT FK_AUDIT_LOGS_ACTOR_MERCHANT
    FOREIGN KEY (ACTOR_MERCHANT_ID) REFERENCES MERCHANTS(ID) ON DELETE SET NULL,
  INDEX IDX_AUDIT_LOGS_ACTOR_USER (ACTOR_USER_ID),
  INDEX IDX_AUDIT_LOGS_ENTITY (ENTITY_TYPE, ENTITY_ID),
  INDEX IDX_AUDIT_LOGS_CREATED_AT (CREATED_AT)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Deleting a user/merchant SET NULLs their actor references here rather
-- than deleting the audit row itself — history is preserved even after
-- the actor account is gone.

-- ================================================================
-- END OF CURRENT GAMERTAVERN SCHEMA (schema/001 through 008)
-- 52 tables total when all 8 files have run in order (this file's own
-- footer count predates schema/009-011 — see Database/README.md for the
-- current total across all files).
-- ================================================================
