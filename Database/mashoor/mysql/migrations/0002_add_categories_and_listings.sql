-- Mashoor migration 0002 — categories, listing fields, vendor category access
-- (MySQL / MariaDB; see 0001 for conventions).
--
-- A vendor sees a published listing only when the listing's category is
-- active and assigned to the vendor's company (mashoor_vendor_company_categories).

-- name_key is the lower-cased, normalized name; it must be unique exactly as
-- stored (binary collation, as in SQLite), so accented names stay distinct.
CREATE TABLE mashoor_categories (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  name_key    VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  description TEXT         NULL,
  active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_by  INT UNSIGNED NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY mashoor_categories_name_key_uq (name_key),
  CONSTRAINT mashoor_categories_created_by_fk FOREIGN KEY (created_by) REFERENCES mashoor_staff_users (id),
  CONSTRAINT mashoor_categories_active_chk CHECK (active IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mashoor_vendor_company_categories (
  company_id  INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  assigned_by INT UNSIGNED NULL,
  assigned_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, category_id),
  KEY mashoor_vendor_company_categories_category_idx (category_id),
  CONSTRAINT mashoor_vcc_company_fk FOREIGN KEY (company_id) REFERENCES mashoor_vendor_companies (id) ON DELETE CASCADE,
  CONSTRAINT mashoor_vcc_category_fk FOREIGN KEY (category_id) REFERENCES mashoor_categories (id) ON DELETE RESTRICT,
  CONSTRAINT mashoor_vcc_assigned_by_fk FOREIGN KEY (assigned_by) REFERENCES mashoor_staff_users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- price_cents is BIGINT: prices up to 999,999,999.99 are accepted.
ALTER TABLE mashoor_catalogs
  ADD COLUMN category_id INT UNSIGNED NULL,
  ADD COLUMN price_cents BIGINT       NULL,
  ADD COLUMN currency    VARCHAR(3)   NOT NULL DEFAULT 'MYR',
  ADD COLUMN image_file  VARCHAR(100) NULL,
  ADD COLUMN image_type  VARCHAR(50)  NULL,
  ADD COLUMN updated_by  INT UNSIGNED NULL,
  ADD KEY mashoor_catalogs_category_status_idx (category_id, status),
  ADD KEY mashoor_catalogs_status_idx (status),
  ADD CONSTRAINT mashoor_catalogs_category_fk FOREIGN KEY (category_id) REFERENCES mashoor_categories (id) ON DELETE RESTRICT,
  ADD CONSTRAINT mashoor_catalogs_updated_by_fk FOREIGN KEY (updated_by) REFERENCES mashoor_staff_users (id),
  ADD CONSTRAINT mashoor_catalogs_price_chk CHECK (price_cents IS NULL OR price_cents >= 0);

ALTER TABLE mashoor_vendor_users
  ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  ADD CONSTRAINT mashoor_vendor_users_must_change_chk CHECK (must_change_password IN (0, 1));

INSERT INTO mashoor_schema_migrations (version, name) VALUES (2, '0002_add_categories_and_listings');
