-- ================================================================
-- Mashoor migration 0006 — Versioned checklist form templates, damage
-- diagrams and structured inspection forms (SQLite, NOT MySQL)
-- ================================================================
-- Purely additive: new tables, new nullable columns and protective triggers.
-- No existing row is changed or removed.
--
-- TEMPLATE VERSIONS: CHECKLIST_TEMPLATES stays the template "family" (vehicle
-- type, name, active). Its form layout lives in CHECKLIST_TEMPLATE_VERSIONS as
-- a JSON definition (document header, vehicle-detail fields with defaults,
-- status legend, numbered sections / items / nested items, measurement fields
-- with units, remarks / next servicing, sign-off captions, damage diagram).
-- A version is edited while 'draft' and frozen once 'published' (trigger
-- below); a change after publishing is a new version. Inspections created from
-- a template record the version and keep their own copy of the definition, so
-- later template changes never reach them.
--
-- Templates from 0005 (flat item lists) and their inspections keep working:
-- the backend reads them through a compatibility layer and converts a legacy
-- template into a published version 1 on start-up (its 0005 rows are kept).
--
-- SEED: the vehicle checklists transcribed from the client's
-- "MASHHOR - MOD CHECKLIST" PDF are imported by Backend/mashoor/src/checklist/
-- seed.js after migrations run. The import is keyed by SEED_KEY, so re-running
-- it never creates duplicates and never overwrites staff edits.
--
-- DIAGRAMS: vehicle damage diagrams. FILE is 'asset:<name>' for diagrams that
-- ship with the backend (cropped from the client's PDF) or a server-generated
-- name in private storage for diagrams uploaded by staff. Served only through
-- access-checked API routes.
--
-- ANSWERS: INSPECTIONS.FORM_ANSWERS is the inspector's working copy (JSON:
-- vehicle details, per-item status / measurements / remark / action, general
-- remarks, next servicing, damage extent / notes / markers with coordinates
-- relative to the diagram). Each submission still freezes everything into a
-- new INSPECTION_REVISIONS row.
--
-- HISTORY PROTECTION: submitted revision snapshots, sign-offs and inspection
-- events cannot be updated or deleted (triggers), and published template
-- versions cannot be edited.

ALTER TABLE checklist_templates ADD COLUMN seed_key TEXT;
CREATE UNIQUE INDEX checklist_templates_seed_key_idx ON checklist_templates (seed_key) WHERE seed_key IS NOT NULL;

CREATE TABLE checklist_diagrams (
  id           INTEGER PRIMARY KEY,
  name         TEXT    NOT NULL,
  vehicle_type TEXT    CHECK (vehicle_type IS NULL OR vehicle_type IN ('FORKLIFT', 'DOUBLE CAB HILUX', 'MEDIUM BUS', 'LARGE BUS')),
  file         TEXT    NOT NULL,
  mime_type    TEXT    NOT NULL,
  source       TEXT,    -- where the image came from (e.g. PDF page), shown to staff
  seed_key     TEXT,
  created_by   INTEGER REFERENCES staff_users (id),
  created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX checklist_diagrams_seed_key_idx ON checklist_diagrams (seed_key) WHERE seed_key IS NOT NULL;

CREATE TABLE checklist_template_versions (
  id           INTEGER PRIMARY KEY,
  template_id  INTEGER NOT NULL REFERENCES checklist_templates (id),
  version      INTEGER NOT NULL,
  state        TEXT    NOT NULL CHECK (state IN ('draft', 'published')),
  definition   TEXT    NOT NULL, -- JSON form definition (see Backend/mashoor/src/checklist/definition.js)
  source_hash  TEXT,             -- content hash of an imported definition (makes the import repeatable)
  created_by   INTEGER REFERENCES staff_users (id),
  created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_by INTEGER REFERENCES staff_users (id),
  published_at TEXT,
  UNIQUE (template_id, version)
);
-- At most one draft per template.
CREATE UNIQUE INDEX checklist_template_versions_draft_idx ON checklist_template_versions (template_id) WHERE state = 'draft';

CREATE TRIGGER checklist_template_versions_frozen
BEFORE UPDATE ON checklist_template_versions
WHEN OLD.state = 'published'
BEGIN
  SELECT RAISE(ABORT, 'Published checklist template versions cannot be changed.');
END;

CREATE TRIGGER checklist_template_versions_no_delete_published
BEFORE DELETE ON checklist_template_versions
WHEN OLD.state = 'published'
BEGIN
  SELECT RAISE(ABORT, 'Published checklist template versions cannot be deleted.');
END;

ALTER TABLE inspections ADD COLUMN template_version_id INTEGER REFERENCES checklist_template_versions (id);
ALTER TABLE inspections ADD COLUMN template_version INTEGER;
ALTER TABLE inspections ADD COLUMN form_definition TEXT; -- JSON copy of the version's definition
ALTER TABLE inspections ADD COLUMN form_answers TEXT;    -- JSON working copy (inspector)

CREATE TRIGGER inspection_revisions_snapshot_frozen
BEFORE UPDATE OF snapshot, revision, inspection_id, has_remarks, submitted_by, submitted_at ON inspection_revisions
BEGIN
  SELECT RAISE(ABORT, 'Submitted inspection revisions cannot be changed.');
END;

CREATE TRIGGER inspection_revisions_no_delete
BEFORE DELETE ON inspection_revisions
BEGIN
  SELECT RAISE(ABORT, 'Submitted inspection revisions cannot be deleted.');
END;

CREATE TRIGGER inspection_signoffs_no_update
BEFORE UPDATE ON inspection_signoffs
BEGIN
  SELECT RAISE(ABORT, 'Recorded sign-offs cannot be changed.');
END;

CREATE TRIGGER inspection_signoffs_no_delete
BEFORE DELETE ON inspection_signoffs
BEGIN
  SELECT RAISE(ABORT, 'Recorded sign-offs cannot be deleted.');
END;

CREATE TRIGGER inspection_events_no_update
BEFORE UPDATE ON inspection_events
BEGIN
  SELECT RAISE(ABORT, 'Inspection history cannot be changed.');
END;

CREATE TRIGGER inspection_events_no_delete
BEFORE DELETE ON inspection_events
BEGIN
  SELECT RAISE(ABORT, 'Inspection history cannot be deleted.');
END;
