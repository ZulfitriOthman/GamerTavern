-- ================================================================
-- 001 — CORE AUTH
-- ================================================================
-- Single identity system for the whole platform: customer, merchant
-- staff, and admin are ALL rows in `USERS`, distinguished only by
-- `USERS.ROLE` and (for MERCHANTS) a `MERCHANT_USERS` membership —
-- see 004_merchants.sql. There is no separate admin_users/sessions
-- table. Canonical REST auth lives in Backend/routes/api/auth.routes.js.
-- ================================================================

CREATE TABLE USERS (
  ID                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ROLE               VARCHAR(20)   NOT NULL DEFAULT 'user',      -- 'user' | 'vendor' | 'admin' — app-validated, not ENUM
  NAME               VARCHAR(100)  NOT NULL,
  EMAIL              VARCHAR(100)  NOT NULL,
  PHONE              VARCHAR(20)   NULL,
  PASSWORD_HASH      VARCHAR(255)  NOT NULL,                     -- bcrypt hash
  PROFILE_ICON       VARCHAR(255)  NULL,
  STATUS             VARCHAR(20)   NOT NULL DEFAULT 'active',    -- 'active' | 'suspended' | 'deleted' — soft delete, never hard-delete a user with real history
  EMAIL_VERIFIED_AT  TIMESTAMP     NULL,
  LAST_LOGIN_AT      TIMESTAMP     NULL,
  CREATED_AT         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY UQ_USERS_EMAIL (EMAIL),
  UNIQUE KEY UQ_USERS_PHONE (PHONE),
  INDEX IDX_USERS_ROLE (ROLE),
  INDEX IDX_USERS_STATUS (STATUS)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE PASSWORD_RESET_TOKENS (
  ID          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  USER_ID     INT UNSIGNED NOT NULL,
  TOKEN_HASH  CHAR(64)     NOT NULL,                             -- SHA-256 of the raw token; raw token is never stored
  EXPIRES_AT  DATETIME     NOT NULL,
  USED_AT     TIMESTAMP    NULL,                                 -- NULL = unused; set when the token is consumed
  CREATED_AT  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_PASSWORD_RESET_TOKENS_USER
    FOREIGN KEY (USER_ID) REFERENCES USERS(ID) ON DELETE CASCADE,
  UNIQUE KEY UQ_PASSWORD_RESET_TOKENS_TOKEN_HASH (TOKEN_HASH),
  INDEX IDX_PASSWORD_RESET_TOKENS_USER (USER_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
