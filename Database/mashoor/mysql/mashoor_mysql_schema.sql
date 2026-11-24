-- Mashoor — complete schema for a NEW, EMPTY MySQL / MariaDB database
-- =====================================================================
--
-- File: Database/mashoor/mysql/mashoor_mysql_schema.sql
--
-- Equals the MySQL migrations in Database/mashoor/mysql/migrations
-- (0001–0008) applied in order (an automated test checks that both produce the
-- same tables, columns, indexes, foreign keys, checks and triggers) and
-- records versions 1–8 in mashoor_schema_migrations, so the backend will not
-- apply them again.
--
-- Run this ONLY on a database that has no mashoor_ tables yet. On a database
-- that already has them, run only the migrations it is missing, in order
-- (Database/mashoor/mysql/migrations; see Database/mashoor/README.md); this script stops at the first CREATE
-- TABLE if the tables already exist.
--
-- Target: MariaDB 10.6+ (confirmed server: 10.6.28-MariaDB) and MySQL 8.0.16+.
-- In MySQL Workbench: select the target schema (double-click it), open this
-- file, and execute the whole script (lightning-bolt icon, not "execute
-- current statement"). It uses DELIMITER for the trigger bodies.

CREATE TABLE mashoor_schema_migrations (
  version    INT UNSIGNED NOT NULL,
  name       VARCHAR(255) NOT NULL,
  applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- Accounts --------------------------------------------------------------

-- Admin (staff) accounts sign in with a username or an email (at least one
-- is required). Both are unique case-insensitively; usernames are stored only
-- lower-case and trimmed (byte-wise CHECK), as for vendor accounts.
CREATE TABLE mashoor_staff_users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(40)  NULL,
  email         VARCHAR(254) NULL,
  name          VARCHAR(200) NOT NULL,
  password_hash VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'admin',
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY mashoor_staff_users_email_uq (email),
  UNIQUE KEY mashoor_staff_users_username_uq (username),
  CONSTRAINT mashoor_staff_users_role_chk CHECK (role IN ('admin')),
  CONSTRAINT mashoor_staff_users_active_chk CHECK (active IN (0, 1)),
  CONSTRAINT mashoor_staff_users_username_chk CHECK (username IS NULL OR CAST(username AS BINARY) = CAST(LOWER(TRIM(username)) AS BINARY)),
  CONSTRAINT mashoor_staff_users_login_chk CHECK (username IS NOT NULL OR email IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mashoor_vendor_companies (
  id                             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                           VARCHAR(200) NOT NULL,
  registration_no                VARCHAR(100) NULL,
  status                         VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at                     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  inspection_ack_blocks_approval TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT mashoor_vendor_companies_status_chk CHECK (status IN ('active', 'suspended')),
  CONSTRAINT mashoor_vendor_companies_ack_chk CHECK (inspection_ack_blocks_approval IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vendor / Client and Inspector logins. Usernames are unique case-insensitively
-- (utf8mb4_unicode_ci) and stored only in the canonical lower-case, trimmed
-- form (byte-wise CHECK). Staff emails are unique case-insensitively too.
CREATE TABLE mashoor_vendor_users (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id           INT UNSIGNED NOT NULL,
  username             VARCHAR(40)  NULL,
  email                VARCHAR(254) NULL,
  name                 VARCHAR(200) NOT NULL,
  password_hash        VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  active               TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at        DATETIME     NULL,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  must_change_password TINYINT(1)   NOT NULL DEFAULT 0,
  role                 VARCHAR(20)  NOT NULL DEFAULT 'client',
  PRIMARY KEY (id),
  UNIQUE KEY mashoor_vendor_users_username_uq (username),
  KEY mashoor_vendor_users_company_idx (company_id),
  CONSTRAINT mashoor_vendor_users_company_fk FOREIGN KEY (company_id) REFERENCES mashoor_vendor_companies (id) ON DELETE RESTRICT,
  CONSTRAINT mashoor_vendor_users_active_chk CHECK (active IN (0, 1)),
  CONSTRAINT mashoor_vendor_users_must_change_chk CHECK (must_change_password IN (0, 1)),
  CONSTRAINT mashoor_vendor_users_username_chk CHECK (username IS NULL OR CAST(username AS BINARY) = CAST(LOWER(TRIM(username)) AS BINARY)),
  CONSTRAINT mashoor_vendor_users_role_chk CHECK (role IN ('client', 'inspector'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Session tokens are stored as SHA-256 hex digests only; times are epoch ms.
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

-- ---- Catalog: categories, listings, vendor access ----------------------------

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

CREATE TABLE mashoor_catalogs (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title        VARCHAR(200) NOT NULL,
  description  TEXT         NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'draft',
  published_at DATETIME     NULL,
  created_by   INT UNSIGNED NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  category_id  INT UNSIGNED NULL,
  price_cents  BIGINT       NULL,
  currency     VARCHAR(3)   NOT NULL DEFAULT 'MYR',
  image_file   VARCHAR(100) NULL,
  image_type   VARCHAR(50)  NULL,
  updated_by   INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY mashoor_catalogs_category_status_idx (category_id, status),
  KEY mashoor_catalogs_status_idx (status),
  CONSTRAINT mashoor_catalogs_created_by_fk FOREIGN KEY (created_by) REFERENCES mashoor_staff_users (id),
  CONSTRAINT mashoor_catalogs_category_fk FOREIGN KEY (category_id) REFERENCES mashoor_categories (id) ON DELETE RESTRICT,
  CONSTRAINT mashoor_catalogs_updated_by_fk FOREIGN KEY (updated_by) REFERENCES mashoor_staff_users (id),
  CONSTRAINT mashoor_catalogs_status_chk CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT mashoor_catalogs_price_chk CHECK (price_cents IS NULL OR price_cents >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Superseded by mashoor_vendor_company_categories; kept, grants nothing.
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

-- A vendor sees a published listing only when its category is active and
-- assigned to the vendor's company here.
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

-- ---- Checklist templates ---------------------------------------------------

CREATE TABLE mashoor_checklist_templates (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vehicle_type   VARCHAR(30)  NOT NULL,
  name           VARCHAR(200) NOT NULL,
  status_options TEXT         CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, -- JSON array of status labels
  active         TINYINT(1)   NOT NULL DEFAULT 1,
  created_by     INT UNSIGNED NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  seed_key       VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  PRIMARY KEY (id),
  KEY mashoor_checklist_templates_type_idx (vehicle_type, active),
  UNIQUE KEY mashoor_checklist_templates_seed_key_uq (seed_key),
  CONSTRAINT mashoor_checklist_templates_created_by_fk FOREIGN KEY (created_by) REFERENCES mashoor_staff_users (id),
  CONSTRAINT mashoor_checklist_templates_type_chk CHECK (vehicle_type IN ('FORKLIFT', 'DOUBLE CAB HILUX', 'MEDIUM BUS', 'LARGE BUS')),
  CONSTRAINT mashoor_checklist_templates_active_chk CHECK (active IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Flat item list of templates created before versioned forms (0005); read only.
CREATE TABLE mashoor_checklist_template_items (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  template_id INT UNSIGNED NOT NULL,
  position    INT          NOT NULL,
  section     TEXT         NULL,
  label       TEXT         NOT NULL,
  PRIMARY KEY (id),
  KEY mashoor_checklist_template_items_template_idx (template_id, position),
  CONSTRAINT mashoor_checklist_template_items_template_fk FOREIGN KEY (template_id) REFERENCES mashoor_checklist_templates (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mashoor_checklist_diagrams (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(120) NOT NULL,
  vehicle_type VARCHAR(30)  NULL,
  file         VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  mime_type    VARCHAR(50)  NOT NULL,
  source       VARCHAR(500) NULL, -- where the image came from (e.g. PDF page), shown to staff
  seed_key     VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  created_by   INT UNSIGNED NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY mashoor_checklist_diagrams_seed_key_uq (seed_key),
  CONSTRAINT mashoor_checklist_diagrams_created_by_fk FOREIGN KEY (created_by) REFERENCES mashoor_staff_users (id),
  CONSTRAINT mashoor_checklist_diagrams_type_chk CHECK (vehicle_type IS NULL OR vehicle_type IN ('FORKLIFT', 'DOUBLE CAB HILUX', 'MEDIUM BUS', 'LARGE BUS'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Numbered versions; published ones are frozen (triggers below); at most one
-- draft per template (unique generated column).
CREATE TABLE mashoor_checklist_template_versions (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  template_id       INT UNSIGNED NOT NULL,
  version           INT UNSIGNED NOT NULL,
  state             VARCHAR(20)  NOT NULL,
  definition        MEDIUMTEXT   CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, -- JSON form definition
  source_hash       CHAR(64)     CHARACTER SET ascii COLLATE ascii_bin NULL,         -- hash of an imported definition
  created_by        INT UNSIGNED NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_by      INT UNSIGNED NULL,
  published_at      DATETIME     NULL,
  draft_template_id INT UNSIGNED GENERATED ALWAYS AS (CASE WHEN state = 'draft' THEN template_id END) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY mashoor_checklist_template_versions_version_uq (template_id, version),
  UNIQUE KEY mashoor_checklist_template_versions_draft_uq (draft_template_id),
  CONSTRAINT mashoor_checklist_template_versions_template_fk FOREIGN KEY (template_id) REFERENCES mashoor_checklist_templates (id),
  CONSTRAINT mashoor_checklist_template_versions_created_by_fk FOREIGN KEY (created_by) REFERENCES mashoor_staff_users (id),
  CONSTRAINT mashoor_checklist_template_versions_published_by_fk FOREIGN KEY (published_by) REFERENCES mashoor_staff_users (id),
  CONSTRAINT mashoor_checklist_template_versions_state_chk CHECK (state IN ('draft', 'published'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- Inspections -------------------------------------------------------------

CREATE TABLE mashoor_inspection_signatories (
  company_id  INT UNSIGNED NOT NULL,
  stage       VARCHAR(20)  NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  assigned_by INT UNSIGNED NULL,
  assigned_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, stage),
  KEY mashoor_inspection_signatories_user_idx (user_id),
  CONSTRAINT mashoor_inspection_signatories_company_fk FOREIGN KEY (company_id) REFERENCES mashoor_vendor_companies (id) ON DELETE CASCADE,
  CONSTRAINT mashoor_inspection_signatories_user_fk FOREIGN KEY (user_id) REFERENCES mashoor_vendor_users (id),
  CONSTRAINT mashoor_inspection_signatories_assigned_by_fk FOREIGN KEY (assigned_by) REFERENCES mashoor_staff_users (id),
  CONSTRAINT mashoor_inspection_signatories_stage_chk CHECK (stage IN ('checked_by', 'agreed_by', 'approved_by', 'acknowledgement'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mashoor_inspections (
  id                      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id              INT UNSIGNED NOT NULL,
  inspector_id            INT UNSIGNED NOT NULL,
  template_id             INT UNSIGNED NULL,
  template_name           VARCHAR(200) NOT NULL,
  status_options          TEXT         CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, -- JSON array copied from the template
  vehicle_type            VARCHAR(30)  NOT NULL,
  vehicle_plate           VARCHAR(60)  NULL,
  vehicle_registration_no VARCHAR(60)  NULL,
  mod_registration_no     VARCHAR(60)  NULL,
  status                  VARCHAR(30)  NOT NULL DEFAULT 'assigned',
  current_revision        INT UNSIGNED NOT NULL DEFAULT 0, -- last submitted revision (0 = never submitted)
  recheck_reason          TEXT         NULL,               -- open re-check request, cleared on resubmission
  created_by              INT UNSIGNED NULL,
  created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at             DATETIME     NULL,
  template_version_id     INT UNSIGNED NULL,
  template_version        INT UNSIGNED NULL,
  form_definition         MEDIUMTEXT   CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL, -- JSON copy of the version's definition
  form_answers            MEDIUMTEXT   CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL, -- JSON working copy (inspector)
  PRIMARY KEY (id),
  KEY mashoor_inspections_company_status_idx (company_id, status),
  KEY mashoor_inspections_inspector_idx (inspector_id, status),
  KEY mashoor_inspections_template_idx (template_id),
  CONSTRAINT mashoor_inspections_company_fk FOREIGN KEY (company_id) REFERENCES mashoor_vendor_companies (id) ON DELETE RESTRICT,
  CONSTRAINT mashoor_inspections_inspector_fk FOREIGN KEY (inspector_id) REFERENCES mashoor_vendor_users (id),
  CONSTRAINT mashoor_inspections_template_fk FOREIGN KEY (template_id) REFERENCES mashoor_checklist_templates (id) ON DELETE SET NULL,
  CONSTRAINT mashoor_inspections_created_by_fk FOREIGN KEY (created_by) REFERENCES mashoor_staff_users (id),
  CONSTRAINT mashoor_inspections_template_version_fk FOREIGN KEY (template_version_id) REFERENCES mashoor_checklist_template_versions (id),
  CONSTRAINT mashoor_inspections_type_chk CHECK (vehicle_type IN ('FORKLIFT', 'DOUBLE CAB HILUX', 'MEDIUM BUS', 'LARGE BUS')),
  CONSTRAINT mashoor_inspections_status_chk CHECK (status IN ('assigned', 'draft', 'pending_verification', 'returned', 'pending_approval', 'approved'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Item rows of inspections created before versioned forms (0005); read only.
CREATE TABLE mashoor_inspection_items (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  inspection_id INT UNSIGNED NOT NULL,
  position      INT          NOT NULL,
  section       TEXT         NULL,
  label         TEXT         NOT NULL,
  status        VARCHAR(100) NULL,
  remark        TEXT         NULL,
  action        TEXT         NULL,
  PRIMARY KEY (id),
  KEY mashoor_inspection_items_inspection_idx (inspection_id, position),
  CONSTRAINT mashoor_inspection_items_inspection_fk FOREIGN KEY (inspection_id) REFERENCES mashoor_inspections (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- History rows: never changed or deleted (triggers), never removed by a
-- cascade (RESTRICT — MySQL runs no triggers for cascaded deletes).
CREATE TABLE mashoor_inspection_revisions (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  inspection_id   INT UNSIGNED NOT NULL,
  revision        INT UNSIGNED NOT NULL,
  snapshot        MEDIUMTEXT   CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, -- JSON: the form exactly as submitted
  has_remarks     TINYINT(1)   NOT NULL,
  acknowledgement VARCHAR(20)  NOT NULL,
  submitted_by    INT UNSIGNED NOT NULL,
  submitted_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_by     INT UNSIGNED NULL, -- client who sent this revision to HOO approval
  verified_at     DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY mashoor_inspection_revisions_revision_uq (inspection_id, revision),
  CONSTRAINT mashoor_inspection_revisions_submitted_by_fk FOREIGN KEY (submitted_by) REFERENCES mashoor_vendor_users (id),
  CONSTRAINT mashoor_inspection_revisions_verified_by_fk FOREIGN KEY (verified_by) REFERENCES mashoor_vendor_users (id),
  CONSTRAINT mashoor_inspection_revisions_inspection_fk FOREIGN KEY (inspection_id) REFERENCES mashoor_inspections (id) ON DELETE RESTRICT,
  CONSTRAINT mashoor_inspection_revisions_remarks_chk CHECK (has_remarks IN (0, 1)),
  CONSTRAINT mashoor_inspection_revisions_ack_chk CHECK (acknowledgement IN ('pending', 'auto', 'acknowledged'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mashoor_inspection_signoffs (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  revision_id   INT UNSIGNED NOT NULL,
  stage         VARCHAR(20)  NOT NULL,
  user_id       INT UNSIGNED NOT NULL,
  name_snapshot VARCHAR(200) NOT NULL,
  signed_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY mashoor_inspection_signoffs_stage_uq (revision_id, stage),
  CONSTRAINT mashoor_inspection_signoffs_user_fk FOREIGN KEY (user_id) REFERENCES mashoor_vendor_users (id),
  CONSTRAINT mashoor_inspection_signoffs_revision_fk FOREIGN KEY (revision_id) REFERENCES mashoor_inspection_revisions (id) ON DELETE RESTRICT,
  CONSTRAINT mashoor_inspection_signoffs_stage_chk CHECK (stage IN ('checked_by', 'agreed_by', 'approved_by', 'acknowledgement'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mashoor_inspection_events (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  inspection_id INT UNSIGNED NOT NULL,
  revision      INT UNSIGNED NULL,
  actor_type    VARCHAR(20)  NOT NULL,
  actor_id      INT UNSIGNED NULL,
  actor_name    VARCHAR(200) NULL,
  action        VARCHAR(100) NOT NULL,
  detail        TEXT         NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY mashoor_inspection_events_inspection_idx (inspection_id, id),
  CONSTRAINT mashoor_inspection_events_inspection_fk FOREIGN KEY (inspection_id) REFERENCES mashoor_inspections (id) ON DELETE RESTRICT,
  CONSTRAINT mashoor_inspection_events_actor_chk CHECK (actor_type IN ('staff', 'vendor', 'system'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- Frozen history (same triggers as migration 0006) -------------------------

DELIMITER $$

CREATE TRIGGER mashoor_template_versions_frozen
BEFORE UPDATE ON mashoor_checklist_template_versions
FOR EACH ROW
BEGIN
  IF OLD.state = 'published' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Published checklist template versions cannot be changed.';
  END IF;
END$$

CREATE TRIGGER mashoor_template_versions_no_delete_published
BEFORE DELETE ON mashoor_checklist_template_versions
FOR EACH ROW
BEGIN
  IF OLD.state = 'published' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Published checklist template versions cannot be deleted.';
  END IF;
END$$

-- Only acknowledgement, verified_by and verified_at may change after submission.
CREATE TRIGGER mashoor_inspection_revisions_frozen
BEFORE UPDATE ON mashoor_inspection_revisions
FOR EACH ROW
BEGIN
  IF NOT (NEW.snapshot <=> OLD.snapshot
          AND NEW.revision <=> OLD.revision
          AND NEW.inspection_id <=> OLD.inspection_id
          AND NEW.has_remarks <=> OLD.has_remarks
          AND NEW.submitted_by <=> OLD.submitted_by
          AND NEW.submitted_at <=> OLD.submitted_at) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Submitted inspection revisions cannot be changed.';
  END IF;
END$$

CREATE TRIGGER mashoor_inspection_revisions_no_delete
BEFORE DELETE ON mashoor_inspection_revisions
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Submitted inspection revisions cannot be deleted.';
END$$

CREATE TRIGGER mashoor_inspection_signoffs_no_update
BEFORE UPDATE ON mashoor_inspection_signoffs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recorded sign-offs cannot be changed.';
END$$

CREATE TRIGGER mashoor_inspection_signoffs_no_delete
BEFORE DELETE ON mashoor_inspection_signoffs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recorded sign-offs cannot be deleted.';
END$$

CREATE TRIGGER mashoor_inspection_events_no_update
BEFORE UPDATE ON mashoor_inspection_events
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Inspection history cannot be changed.';
END$$

CREATE TRIGGER mashoor_inspection_events_no_delete
BEFORE DELETE ON mashoor_inspection_events
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Inspection history cannot be deleted.';
END$$

DELIMITER ;

-- ---- Recorded as migrations 0001–0008 (0008 only adds what this file already has) ---------------------------------------

INSERT INTO mashoor_schema_migrations (version, name) VALUES
  (1, '0001_initial_schema'),
  (2, '0002_add_categories_and_listings'),
  (3, '0003_vendor_username_login'),
  (4, '0004_optional_vendor_password_change'),
  (5, '0005_inspector_role_and_vehicle_inspections'),
  (6, '0006_checklist_form_templates'),
  (7, '0007_staff_username_login'),
  (8, '0008_schema_migrations_and_history_triggers');
