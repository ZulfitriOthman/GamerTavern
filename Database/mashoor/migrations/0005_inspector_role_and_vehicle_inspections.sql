-- ================================================================
-- Mashoor migration 0005 — Inspector role, vehicle inspection checklists,
-- client verification, acknowledgement and signatory sign-offs
-- (SQLite, NOT MySQL)
-- ================================================================
-- Purely additive: one new column on VENDOR_USERS (default keeps every
-- existing account a Vendor/Client), one on VENDOR_COMPANIES (default off),
-- and new tables. No existing row changes meaning.
--
-- ROLES: VENDOR_USERS.ROLE = 'client' (Vendor / Client — catalogs + inspection
-- verification) or 'inspector' (fills in checklists). Set per login account by
-- staff; the backend enforces it on every request.
--
-- TEMPLATES: no checklist content existed in this project, so none is seeded.
-- Staff enter each vehicle type's items and its status options (the client's
-- own wording) in the admin site. An inspection COPIES its template's items
-- and status options when it is created, so later template edits never alter
-- an existing inspection.
--
-- REVISIONS: every submission freezes the checklist into
-- INSPECTION_REVISIONS.SNAPSHOT (JSON). Verification, acknowledgement and
-- sign-offs reference that exact revision; a re-check + resubmission creates a
-- new revision, so older sign-offs can never be shown as applying to changed
-- content. Nothing is deleted on return/resubmit.
--
-- SIGNATORIES: per company, each stage (checked_by, agreed_by, approved_by =
-- Head of Operation, acknowledgement) is assigned to one specific account id.
-- Nobody holds a stage by default. Signing requires that account's own
-- authenticated session plus re-entering its recorded full name.
--
-- ACKNOWLEDGEMENT: per revision — 'pending' when any checklist remark is
-- non-empty, 'auto' (recorded as a system action) when there are none,
-- 'acknowledged' once the assigned acknowledger confirms.
-- VENDOR_COMPANIES.INSPECTION_ACK_BLOCKS_APPROVAL decides whether a pending
-- acknowledgement blocks Head of Operation approval (default 0 = it does not;
-- this is a business decision left to staff).

ALTER TABLE vendor_users ADD COLUMN role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'inspector'));
ALTER TABLE vendor_companies ADD COLUMN inspection_ack_blocks_approval INTEGER NOT NULL DEFAULT 0
  CHECK (inspection_ack_blocks_approval IN (0, 1));

CREATE TABLE checklist_templates (
  id             INTEGER PRIMARY KEY,
  vehicle_type   TEXT    NOT NULL CHECK (vehicle_type IN ('FORKLIFT', 'DOUBLE CAB HILUX', 'MEDIUM BUS', 'LARGE BUS')),
  name           TEXT    NOT NULL,
  status_options TEXT    NOT NULL, -- JSON array of the client's status labels, in display order
  active         INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_by     INTEGER REFERENCES staff_users (id),
  created_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX checklist_templates_type_idx ON checklist_templates (vehicle_type, active);

CREATE TABLE checklist_template_items (
  id          INTEGER PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES checklist_templates (id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  section     TEXT,
  label       TEXT    NOT NULL
);
CREATE INDEX checklist_template_items_template_idx ON checklist_template_items (template_id, position);

CREATE TABLE inspection_signatories (
  company_id  INTEGER NOT NULL REFERENCES vendor_companies (id) ON DELETE CASCADE,
  stage       TEXT    NOT NULL CHECK (stage IN ('checked_by', 'agreed_by', 'approved_by', 'acknowledgement')),
  user_id     INTEGER NOT NULL REFERENCES vendor_users (id),
  assigned_by INTEGER REFERENCES staff_users (id),
  assigned_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, stage)
);

CREATE TABLE inspections (
  id                      INTEGER PRIMARY KEY,
  company_id              INTEGER NOT NULL REFERENCES vendor_companies (id) ON DELETE RESTRICT,
  inspector_id            INTEGER NOT NULL REFERENCES vendor_users (id),
  template_id             INTEGER REFERENCES checklist_templates (id) ON DELETE SET NULL,
  template_name           TEXT    NOT NULL,
  status_options          TEXT    NOT NULL, -- JSON array copied from the template
  vehicle_type            TEXT    NOT NULL CHECK (vehicle_type IN ('FORKLIFT', 'DOUBLE CAB HILUX', 'MEDIUM BUS', 'LARGE BUS')),
  vehicle_plate           TEXT,
  vehicle_registration_no TEXT,
  mod_registration_no     TEXT,
  status                  TEXT    NOT NULL DEFAULT 'assigned'
                          CHECK (status IN ('assigned', 'draft', 'pending_verification', 'returned', 'pending_approval', 'approved')),
  current_revision        INTEGER NOT NULL DEFAULT 0, -- last submitted revision number (0 = never submitted)
  recheck_reason          TEXT,                       -- open re-check request, cleared on resubmission
  created_by              INTEGER REFERENCES staff_users (id),
  created_at              TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at             TEXT
);
CREATE INDEX inspections_company_status_idx ON inspections (company_id, status);
CREATE INDEX inspections_inspector_idx ON inspections (inspector_id, status);

-- The working copy the inspector edits. Labels/sections are copied from the template.
CREATE TABLE inspection_items (
  id            INTEGER PRIMARY KEY,
  inspection_id INTEGER NOT NULL REFERENCES inspections (id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  section       TEXT,
  label         TEXT    NOT NULL,
  status        TEXT,
  remark        TEXT,
  action        TEXT
);
CREATE INDEX inspection_items_inspection_idx ON inspection_items (inspection_id, position);

CREATE TABLE inspection_revisions (
  id              INTEGER PRIMARY KEY,
  inspection_id   INTEGER NOT NULL REFERENCES inspections (id) ON DELETE CASCADE,
  revision        INTEGER NOT NULL,
  snapshot        TEXT    NOT NULL, -- JSON: vehicle details + items exactly as submitted
  has_remarks     INTEGER NOT NULL CHECK (has_remarks IN (0, 1)),
  acknowledgement TEXT    NOT NULL CHECK (acknowledgement IN ('pending', 'auto', 'acknowledged')),
  submitted_by    INTEGER NOT NULL REFERENCES vendor_users (id),
  submitted_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_by     INTEGER REFERENCES vendor_users (id), -- client who sent this revision to HOO approval
  verified_at     TEXT,
  UNIQUE (inspection_id, revision)
);

-- One confirmation per stage per revision (prevents duplicates).
CREATE TABLE inspection_signoffs (
  id            INTEGER PRIMARY KEY,
  revision_id   INTEGER NOT NULL REFERENCES inspection_revisions (id) ON DELETE CASCADE,
  stage         TEXT    NOT NULL CHECK (stage IN ('checked_by', 'agreed_by', 'approved_by', 'acknowledgement')),
  user_id       INTEGER NOT NULL REFERENCES vendor_users (id),
  name_snapshot TEXT    NOT NULL,
  signed_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (revision_id, stage)
);

-- Workflow history shown on the inspection (also mirrored to AUDIT_LOG).
CREATE TABLE inspection_events (
  id            INTEGER PRIMARY KEY,
  inspection_id INTEGER NOT NULL REFERENCES inspections (id) ON DELETE CASCADE,
  revision      INTEGER,
  actor_type    TEXT    NOT NULL CHECK (actor_type IN ('staff', 'vendor', 'system')),
  actor_id      INTEGER,
  actor_name    TEXT,
  action        TEXT    NOT NULL,
  detail        TEXT,
  created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX inspection_events_inspection_idx ON inspection_events (inspection_id, id);
