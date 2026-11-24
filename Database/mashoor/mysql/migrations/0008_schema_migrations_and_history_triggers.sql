-- Mashoor MySQL migration 0008 — migration ledger and frozen-history triggers
-- (MariaDB 10.6 / MySQL 8.0.29+; see 0001 for conventions).
--
-- Why: a database created by hand (e.g. part of mashoor_mysql_schema.sql run in
-- MySQL Workbench) can have every mashoor_ table, column, index, foreign key and
-- CHECK of versions 0001–0007 but lack
--   * mashoor_schema_migrations (the backend reads it to know the schema version), and
--   * the 8 triggers that keep history immutable: published checklist template
--     versions, submitted inspection revisions, recorded sign-offs and the
--     inspection history (events) cannot be changed or deleted.
-- Verified on nanashi_collectibles before writing this file: all 19 tables, 25
-- CHECK constraints, 32 foreign keys and 59 indexes present; no
-- mashoor_schema_migrations; no triggers.
--
-- Additive and idempotent: creates only what is missing, never alters, drops or
-- empties a table. On a database built from migrations 0001–0007 it only adds
-- the version 8 row.
--
-- Precondition: the tables already match 0001–0007 (it records those versions
-- as applied). Check that first with Database/mashoor/README.md, never run it
-- on a database whose mashoor_ tables are older.
--
-- In MySQL Workbench: select the schema, open this file and execute the whole
-- script (lightning bolt). It uses DELIMITER for the trigger bodies.

CREATE TABLE IF NOT EXISTS mashoor_schema_migrations (
  version    INT UNSIGNED NOT NULL,
  name       VARCHAR(255) NOT NULL,
  applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO mashoor_schema_migrations (version, name) VALUES
  (1, '0001_initial_schema'),
  (2, '0002_add_categories_and_listings'),
  (3, '0003_vendor_username_login'),
  (4, '0004_optional_vendor_password_change'),
  (5, '0005_inspector_role_and_vehicle_inspections'),
  (6, '0006_checklist_form_templates'),
  (7, '0007_staff_username_login');

-- Same trigger bodies as migration 0006 / mashoor_mysql_schema.sql.
DELIMITER $$

CREATE TRIGGER IF NOT EXISTS mashoor_template_versions_frozen
BEFORE UPDATE ON mashoor_checklist_template_versions
FOR EACH ROW
BEGIN
  IF OLD.state = 'published' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Published checklist template versions cannot be changed.';
  END IF;
END$$

CREATE TRIGGER IF NOT EXISTS mashoor_template_versions_no_delete_published
BEFORE DELETE ON mashoor_checklist_template_versions
FOR EACH ROW
BEGIN
  IF OLD.state = 'published' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Published checklist template versions cannot be deleted.';
  END IF;
END$$

-- Only acknowledgement, verified_by and verified_at may change after submission.
CREATE TRIGGER IF NOT EXISTS mashoor_inspection_revisions_frozen
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

CREATE TRIGGER IF NOT EXISTS mashoor_inspection_revisions_no_delete
BEFORE DELETE ON mashoor_inspection_revisions
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Submitted inspection revisions cannot be deleted.';
END$$

CREATE TRIGGER IF NOT EXISTS mashoor_inspection_signoffs_no_update
BEFORE UPDATE ON mashoor_inspection_signoffs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recorded sign-offs cannot be changed.';
END$$

CREATE TRIGGER IF NOT EXISTS mashoor_inspection_signoffs_no_delete
BEFORE DELETE ON mashoor_inspection_signoffs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recorded sign-offs cannot be deleted.';
END$$

CREATE TRIGGER IF NOT EXISTS mashoor_inspection_events_no_update
BEFORE UPDATE ON mashoor_inspection_events
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Inspection history cannot be changed.';
END$$

CREATE TRIGGER IF NOT EXISTS mashoor_inspection_events_no_delete
BEFORE DELETE ON mashoor_inspection_events
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Inspection history cannot be deleted.';
END$$

DELIMITER ;

INSERT IGNORE INTO mashoor_schema_migrations (version, name) VALUES (8, '0008_schema_migrations_and_history_triggers');
