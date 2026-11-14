-- ================================================================
-- Mashoor migration 0002 — categories, category-based catalog access,
-- catalog listing fields, first-login password change (SQLite, NOT MySQL)
-- ================================================================
-- Purely additive: two new tables, new nullable / defaulted columns,
-- new indexes. No existing row is changed or removed.
--
-- REUSED, NOT DUPLICATED:
--   VENDOR_COMPANIES  — "the vendor". Categories are assigned per company,
--                       exactly like access was already granted per company;
--                       every login of the company shares the same access.
--   VENDOR_USERS      — the vendor's login accounts (contact name + email).
--   CATALOGS          — each row is one catalog LISTING. Its existing STATUS
--                       values keep their meaning: 'draft' (= unpublished),
--                       'published', 'archived'.
--   AUDIT_LOG         — every admin change below is recorded there.
--
-- ACCESS RULE (enforced in Backend/mashoor/src/catalogAccess.js only):
--   a vendor company sees a listing iff the listing is 'published', its
--   category is active, the category is assigned to the company
--   (VENDOR_COMPANY_CATEGORIES), and the company is active.
--   CATALOG_ASSIGNMENTS (per-catalog sharing from 0001) is SUPERSEDED: it
--   was never exposed through any route, held 0 rows when this migration
--   was written, and no longer grants access. It is kept, not dropped, so
--   no data can be lost.
--
-- CATEGORIES.NAME_KEY is the normalized name (Unicode NFKC, trimmed,
-- inner whitespace collapsed, lower-cased) computed by the backend; the
-- UNIQUE index on it is what prevents "Office Chairs" / " office  chairs".
--
-- CATALOGS.CATEGORY_ID is nullable at the database level only because
-- SQLite cannot add a NOT NULL foreign-key column to an existing table.
-- The backend requires it for every listing it creates or edits, and a
-- listing without a category can never be visible to a vendor (the access
-- join requires one). ON DELETE RESTRICT: a category that still has
-- listings or vendor assignments cannot be deleted (the API also explains
-- what must be reassigned first).
--
-- CATALOGS.IMAGE_FILE is a server-generated file name inside the module's
-- private storage directory (never Backend/public); images are served only
-- through access-checked API routes. PRICE_CENTS is optional.
--
-- VENDOR_USERS.MUST_CHANGE_PASSWORD = 1 for accounts whose password was set
-- by staff (new account or reset). Such a session can only read /auth/me,
-- change its password and sign out until the password is changed.
-- Existing accounts default to 0.

CREATE TABLE categories (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  name_key    TEXT    NOT NULL UNIQUE,
  description TEXT,
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_by  INTEGER REFERENCES staff_users (id),
  created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Many-to-many: a company receives several categories, a category is shared
-- with several companies. No row = no access.
CREATE TABLE vendor_company_categories (
  company_id  INTEGER NOT NULL REFERENCES vendor_companies (id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  assigned_by INTEGER REFERENCES staff_users (id),
  assigned_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, category_id)
);
CREATE INDEX vendor_company_categories_category_idx ON vendor_company_categories (category_id);

ALTER TABLE catalogs ADD COLUMN category_id INTEGER REFERENCES categories (id) ON DELETE RESTRICT;
ALTER TABLE catalogs ADD COLUMN price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0);
ALTER TABLE catalogs ADD COLUMN currency TEXT NOT NULL DEFAULT 'MYR';
ALTER TABLE catalogs ADD COLUMN image_file TEXT;
ALTER TABLE catalogs ADD COLUMN image_type TEXT;
ALTER TABLE catalogs ADD COLUMN updated_by INTEGER REFERENCES staff_users (id);
CREATE INDEX catalogs_category_status_idx ON catalogs (category_id, status);
CREATE INDEX catalogs_status_idx ON catalogs (status);

ALTER TABLE vendor_users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0
  CHECK (must_change_password IN (0, 1));
