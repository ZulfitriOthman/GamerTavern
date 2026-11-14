-- ================================================================
-- Mashoor migration 0003 — vendors sign in with a username, not an email
-- (SQLite, NOT MySQL)
-- ================================================================
-- VENDOR_USERS gains USERNAME (the sign-in identifier) and EMAIL becomes
-- optional, informational only: no NOT NULL, no UNIQUE, never used to sign
-- in or to recover a password (there is no email channel; staff reset
-- passwords in the admin site).
--
-- SQLite cannot drop NOT NULL / UNIQUE from an existing column, so the table
-- is rebuilt and every row copied with the SAME id (sessions.user_id and
-- audit_log.target_id refer to vendor users by id; no foreign key references
-- this table). Nothing is deleted: every existing account keeps its company,
-- name, email, password hash, active flag, must-change flag and timestamps.
--
-- USERNAME is stored canonical (trimmed, lower-case; the backend allows
-- a-z 0-9 . _ - , 3–40 characters, starting with a letter or digit), so the
-- plain UNIQUE constraint is case-insensitive in effect; the CHECK keeps the
-- database honest about that. Accounts that existed before this migration get
-- USERNAME = NULL on purpose — no username is invented for them. They cannot
-- sign in until staff set one explicitly (admin site → vendor → Edit, or
-- PATCH /api/mashoor/admin/vendor-users/:id { "username": "..." }).
-- SQLite allows any number of NULLs in a UNIQUE column.

CREATE TABLE vendor_users_new (
  id                   INTEGER PRIMARY KEY,
  company_id           INTEGER NOT NULL REFERENCES vendor_companies (id) ON DELETE RESTRICT,
  username             TEXT    UNIQUE CHECK (username IS NULL OR username = lower(trim(username))),
  email                TEXT,
  name                 TEXT    NOT NULL,
  password_hash        TEXT    NOT NULL,
  active               INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1)),
  last_login_at        TEXT,
  created_at           TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO vendor_users_new
       (id, company_id, username, email, name, password_hash, active, must_change_password, last_login_at, created_at)
SELECT  id, company_id, NULL,     email, name, password_hash, active, must_change_password, last_login_at, created_at
  FROM vendor_users;

DROP TABLE vendor_users;
ALTER TABLE vendor_users_new RENAME TO vendor_users;
CREATE INDEX vendor_users_company_idx ON vendor_users (company_id);
