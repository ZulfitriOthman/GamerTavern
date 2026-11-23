-- Mashoor MySQL migration 0001 — initial schema (MySQL / MariaDB)
--
-- MySQL migration path: Database/mashoor/mysql/migrations (this folder).
-- The files in Database/mashoor/migrations are the historical SQLite ones —
-- do not run those in MySQL.
--
-- Target: MariaDB 10.6+ (confirmed server: 10.6.28-MariaDB) and MySQL 8.0.16+.
-- The backend applies these files itself, in order, recording each in
-- mashoor_schema_migrations. For a brand-new database you may instead run
-- ../mashoor_mysql_schema.sql once (it equals 0001–0006 applied in order).
--
-- Every Mashoor table is prefixed mashoor_ so it can share a database with
-- other applications. Tables state their character set explicitly because the
-- server default may be latin1. Timestamps are DATETIME in UTC (the backend
-- sets time_zone = '+00:00' on every connection).

CREATE TABLE IF NOT EXISTS mashoor_schema_migrations (
  version    INT UNSIGNED NOT NULL,
  name       VARCHAR(255) NOT NULL,
  applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mashoor staff (admin site). Email is unique case-insensitively, as in the
-- SQLite schema (utf8mb4_unicode_ci is a case-insensitive collation).
CREATE TABLE mashoor_staff_users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(254) NOT NULL,
  name          VARCHAR(200) NOT NULL,
  password_hash VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'admin',
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY mashoor_staff_users_email_uq (email),
  CONSTRAINT mashoor_staff_users_role_chk CHECK (role IN ('admin')),
  CONSTRAINT mashoor_staff_users_active_chk CHECK (active IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mashoor_vendor_companies (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name            VARCHAR(200) NOT NULL,
  registration_no VARCHAR(100) NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT mashoor_vendor_companies_status_chk CHECK (status IN ('active', 'suspended'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mashoor_vendor_users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id    INT UNSIGNED NOT NULL,
  email         VARCHAR(254) NOT NULL,
  name          VARCHAR(200) NOT NULL,
  password_hash VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY mashoor_vendor_users_email_uq (email),
  KEY mashoor_vendor_users_company_idx (company_id),
  CONSTRAINT mashoor_vendor_users_company_fk FOREIGN KEY (company_id) REFERENCES mashoor_vendor_companies (id) ON DELETE RESTRICT,
  CONSTRAINT mashoor_vendor_users_active_chk CHECK (active IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mashoor_catalogs (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title        VARCHAR(200) NOT NULL,
  description  TEXT         NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'draft',
  published_at DATETIME     NULL,
  created_by   INT UNSIGNED NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT mashoor_catalogs_created_by_fk FOREIGN KEY (created_by) REFERENCES mashoor_staff_users (id),
  CONSTRAINT mashoor_catalogs_status_chk CHECK (status IN ('draft', 'published', 'archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Superseded by mashoor_vendor_company_categories (0002); kept, grants nothing.
CREATE TABLE mashoor_catalog_assignments (
  catalog_id  INT UNSIGNED NOT NULL,
  company_id  INT UNSIGNED NOT NULL,
  assigned_by INT UNSIGNED NULL,
  assigned_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (catalog_id, company_id),
  KEY mashoor_catalog_assignments_company_idx (company_id),
  CONSTRAINT mashoor_catalog_assignments_catalog_fk FOREIGN KEY (catalog_id) REFERENCES mashoor_catalogs (id) ON DELETE CASCADE,
  CONSTRAINT mashoor_catalog_assignments_company_fk FOREIGN KEY (company_id) REFERENCES mashoor_vendor_companies (id) ON DELETE CASCADE,
  CONSTRAINT mashoor_catalog_assignments_assigned_by_fk FOREIGN KEY (assigned_by) REFERENCES mashoor_staff_users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Session tokens are stored as SHA-256 hex digests only. created_at /
-- expires_at are epoch milliseconds (as in the SQLite schema).
CREATE TABLE mashoor_sessions (
  token_hash CHAR(64)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_type  VARCHAR(10)  NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  created_at BIGINT       NOT NULL,
  expires_at BIGINT       NOT NULL,
  PRIMARY KEY (token_hash),
  KEY mashoor_sessions_user_idx (user_type, user_id),
  KEY mashoor_sessions_expires_idx (expires_at),
  CONSTRAINT mashoor_sessions_user_type_chk CHECK (user_type IN ('staff', 'vendor'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mashoor_audit_log (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_type  VARCHAR(20)  NOT NULL,
  actor_id    INT UNSIGNED NULL,
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50)  NULL,
  target_id   INT UNSIGNED NULL,
  metadata    TEXT         CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL, -- JSON
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO mashoor_schema_migrations (version, name) VALUES (1, '0001_initial_schema');
