-- Mashoor migration 0005 — Inspector role and vehicle inspection checklists
-- (MySQL / MariaDB; see 0001 for conventions).
--
-- Vendor accounts get a role ('client' = Vendor / Client, or 'inspector');
-- every existing account becomes 'client'. Staff create inspections from
-- checklist templates; the inspector fills them in, the client verifies, and
-- assigned accounts sign off per revision. JSON columns use a binary collation
-- so their text is stored and compared exactly.

ALTER TABLE mashoor_vendor_users
  ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'client',
  ADD CONSTRAINT mashoor_vendor_users_role_chk CHECK (role IN ('client', 'inspector'));

ALTER TABLE mashoor_vendor_companies
  ADD COLUMN inspection_ack_blocks_approval TINYINT(1) NOT NULL DEFAULT 0,
  ADD CONSTRAINT mashoor_vendor_companies_ack_chk CHECK (inspection_ack_blocks_approval IN (0, 1));

CREATE TABLE mashoor_checklist_templates (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vehicle_type   VARCHAR(30)  NOT NULL,
  name           VARCHAR(200) NOT NULL,
  status_options TEXT         CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, -- JSON array of status labels
  active         TINYINT(1)   NOT NULL DEFAULT 1,
  created_by     INT UNSIGNED NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY mashoor_checklist_templates_type_idx (vehicle_type, active),
  CONSTRAINT mashoor_checklist_templates_created_by_fk FOREIGN KEY (created_by) REFERENCES mashoor_staff_users (id),
  CONSTRAINT mashoor_checklist_templates_type_chk CHECK (vehicle_type IN ('FORKLIFT', 'DOUBLE CAB HILUX', 'MEDIUM BUS', 'LARGE BUS')),
  CONSTRAINT mashoor_checklist_templates_active_chk CHECK (active IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  PRIMARY KEY (id),
  KEY mashoor_inspections_company_status_idx (company_id, status),
  KEY mashoor_inspections_inspector_idx (inspector_id, status),
  KEY mashoor_inspections_template_idx (template_id),
  CONSTRAINT mashoor_inspections_company_fk FOREIGN KEY (company_id) REFERENCES mashoor_vendor_companies (id) ON DELETE RESTRICT,
  CONSTRAINT mashoor_inspections_inspector_fk FOREIGN KEY (inspector_id) REFERENCES mashoor_vendor_users (id),
  CONSTRAINT mashoor_inspections_template_fk FOREIGN KEY (template_id) REFERENCES mashoor_checklist_templates (id) ON DELETE SET NULL,
  CONSTRAINT mashoor_inspections_created_by_fk FOREIGN KEY (created_by) REFERENCES mashoor_staff_users (id),
  CONSTRAINT mashoor_inspections_type_chk CHECK (vehicle_type IN ('FORKLIFT', 'DOUBLE CAB HILUX', 'MEDIUM BUS', 'LARGE BUS')),
  CONSTRAINT mashoor_inspections_status_chk CHECK (status IN ('assigned', 'draft', 'pending_verification', 'returned', 'pending_approval', 'approved'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  CONSTRAINT mashoor_inspection_revisions_inspection_fk FOREIGN KEY (inspection_id) REFERENCES mashoor_inspections (id) ON DELETE CASCADE,
  CONSTRAINT mashoor_inspection_revisions_submitted_by_fk FOREIGN KEY (submitted_by) REFERENCES mashoor_vendor_users (id),
  CONSTRAINT mashoor_inspection_revisions_verified_by_fk FOREIGN KEY (verified_by) REFERENCES mashoor_vendor_users (id),
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
  CONSTRAINT mashoor_inspection_signoffs_revision_fk FOREIGN KEY (revision_id) REFERENCES mashoor_inspection_revisions (id) ON DELETE CASCADE,
  CONSTRAINT mashoor_inspection_signoffs_user_fk FOREIGN KEY (user_id) REFERENCES mashoor_vendor_users (id),
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
  CONSTRAINT mashoor_inspection_events_inspection_fk FOREIGN KEY (inspection_id) REFERENCES mashoor_inspections (id) ON DELETE CASCADE,
  CONSTRAINT mashoor_inspection_events_actor_chk CHECK (actor_type IN ('staff', 'vendor', 'system'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO mashoor_schema_migrations (version, name) VALUES (5, '0005_inspector_role_and_vehicle_inspections');
