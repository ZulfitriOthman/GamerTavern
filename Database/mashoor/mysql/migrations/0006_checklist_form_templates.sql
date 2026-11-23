-- Mashoor migration 0006 — versioned checklist form templates, damage diagrams,
-- frozen history (MySQL / MariaDB; see 0001 for conventions).
--
-- Contains triggers with BEGIN … END bodies, so it uses DELIMITER (MySQL
-- Workbench and the mysql client understand it; so does the backend's runner).
--
--   * Templates get numbered versions (draft → published). A published
--     version can never be changed or deleted (triggers). At most one draft
--     per template (unique index on a generated column — MySQL/MariaDB have no
--     partial indexes).
--   * Each inspection keeps its own copy of the version it was created from.
--   * Submitted revisions, sign-offs and inspection events can never be
--     changed or deleted (triggers); only a revision's acknowledgement and
--     verification fields may still be set.
--   * MySQL does not run triggers for rows removed by ON DELETE CASCADE, so
--     the history tables' foreign keys become RESTRICT here: deleting an
--     inspection (or revision) that has history is refused, as it was in
--     SQLite (where the triggers aborted the cascade).

ALTER TABLE mashoor_checklist_templates
  ADD COLUMN seed_key VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  ADD UNIQUE KEY mashoor_checklist_templates_seed_key_uq (seed_key);

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
  -- template_id while this row is the draft, otherwise NULL: unique ⇒ one draft per template.
  draft_template_id INT UNSIGNED GENERATED ALWAYS AS (CASE WHEN state = 'draft' THEN template_id END) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY mashoor_checklist_template_versions_version_uq (template_id, version),
  UNIQUE KEY mashoor_checklist_template_versions_draft_uq (draft_template_id),
  CONSTRAINT mashoor_checklist_template_versions_template_fk FOREIGN KEY (template_id) REFERENCES mashoor_checklist_templates (id),
  CONSTRAINT mashoor_checklist_template_versions_created_by_fk FOREIGN KEY (created_by) REFERENCES mashoor_staff_users (id),
  CONSTRAINT mashoor_checklist_template_versions_published_by_fk FOREIGN KEY (published_by) REFERENCES mashoor_staff_users (id),
  CONSTRAINT mashoor_checklist_template_versions_state_chk CHECK (state IN ('draft', 'published'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE mashoor_inspections
  ADD COLUMN template_version_id INT UNSIGNED NULL,
  ADD COLUMN template_version    INT UNSIGNED NULL,
  ADD COLUMN form_definition     MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL, -- JSON copy of the version's definition
  ADD COLUMN form_answers        MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL, -- JSON working copy (inspector)
  ADD CONSTRAINT mashoor_inspections_template_version_fk FOREIGN KEY (template_version_id) REFERENCES mashoor_checklist_template_versions (id);

-- History rows are never removed by a cascade (see the header).
ALTER TABLE mashoor_inspection_revisions DROP FOREIGN KEY mashoor_inspection_revisions_inspection_fk;
ALTER TABLE mashoor_inspection_revisions
  ADD CONSTRAINT mashoor_inspection_revisions_inspection_fk FOREIGN KEY (inspection_id) REFERENCES mashoor_inspections (id) ON DELETE RESTRICT;
ALTER TABLE mashoor_inspection_signoffs DROP FOREIGN KEY mashoor_inspection_signoffs_revision_fk;
ALTER TABLE mashoor_inspection_signoffs
  ADD CONSTRAINT mashoor_inspection_signoffs_revision_fk FOREIGN KEY (revision_id) REFERENCES mashoor_inspection_revisions (id) ON DELETE RESTRICT;
ALTER TABLE mashoor_inspection_events DROP FOREIGN KEY mashoor_inspection_events_inspection_fk;
ALTER TABLE mashoor_inspection_events
  ADD CONSTRAINT mashoor_inspection_events_inspection_fk FOREIGN KEY (inspection_id) REFERENCES mashoor_inspections (id) ON DELETE RESTRICT;

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

INSERT INTO mashoor_schema_migrations (version, name) VALUES (6, '0006_checklist_form_templates');
