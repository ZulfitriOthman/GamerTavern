-- ================================================================
-- Mashoor migration 0001 — initial schema (SQLite, NOT MySQL)
-- ================================================================
-- Accounts, vendor companies, catalogs, per-catalog assignments,
-- sessions, audit log. Shipped as migration 1 of Backend/mashoor
-- (formerly Listing-Sample/Mashoor/server); already applied to
-- existing Mashoor databases. NEVER EDIT: the runner applies files in
-- order once each and records progress in PRAGMA user_version.
CREATE TABLE staff_users (
  id            INTEGER PRIMARY KEY,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vendor_companies (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  registration_no TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Each vendor login belongs to exactly one company; access is granted per company.
CREATE TABLE vendor_users (
  id            INTEGER PRIMARY KEY,
  company_id    INTEGER NOT NULL REFERENCES vendor_companies (id) ON DELETE RESTRICT,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  last_login_at TEXT,
  created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX vendor_users_company_idx ON vendor_users (company_id);

-- Catalog content fields (files / product items) are pending client confirmation.
CREATE TABLE catalogs (
  id           INTEGER PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TEXT,
  created_by   INTEGER REFERENCES staff_users (id),
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Many-to-many: a catalog is shared with several companies, a company receives several catalogs.
-- No row = no access. Revoking deletes the row (history lives in audit_log).
CREATE TABLE catalog_assignments (
  catalog_id  INTEGER NOT NULL REFERENCES catalogs (id) ON DELETE CASCADE,
  company_id  INTEGER NOT NULL REFERENCES vendor_companies (id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES staff_users (id),
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (catalog_id, company_id)
);
CREATE INDEX catalog_assignments_company_idx ON catalog_assignments (company_id);

-- Only a SHA-256 of the session token is stored, never the token itself.
CREATE TABLE sessions (
  token_hash TEXT    PRIMARY KEY,
  user_type  TEXT    NOT NULL CHECK (user_type IN ('staff', 'vendor')),
  user_id    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_type, user_id);

CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY,
  actor_type  TEXT NOT NULL,
  actor_id    INTEGER,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   INTEGER,
  metadata    TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
