-- Mashoor MySQL migration 0009 — organisations can be removed (archived)
-- (MariaDB 10.6 / MySQL 8.0.19+; see 0001 for conventions). MySQL-only: there
-- is no SQLite counterpart.
--
--   * mashoor_vendor_companies.status gains 'removed': a soft removal. The row,
--     its portal accounts, inspections, revisions, sign-offs and history all
--     stay (they reference the company with ON DELETE RESTRICT and the history
--     tables are frozen by the 0006/0008 triggers, so a hard delete is neither
--     possible nor wanted).
--   * removed_at / removed_by record when and by which admin. They are set
--     exactly when status = 'removed' (CHECK), and removed_by must be a staff
--     account (foreign key; staff accounts are deactivated, never deleted).
--   * Removal is final at the API level: the backend refuses to change a
--     removed organisation. Portal access is refused because sign-in and every
--     portal request already require status = 'active'.
--
-- Additive: existing rows keep status 'active' / 'suspended' with both new
-- columns NULL. Apply in MySQL Workbench (whole script) or with
-- `npm run mashoor:migrate -- --apply` from Backend/.

ALTER TABLE mashoor_vendor_companies
  DROP CONSTRAINT mashoor_vendor_companies_status_chk;

ALTER TABLE mashoor_vendor_companies
  ADD COLUMN removed_at DATETIME     NULL AFTER inspection_ack_blocks_approval,
  ADD COLUMN removed_by INT UNSIGNED NULL AFTER removed_at,
  ADD KEY mashoor_vendor_companies_status_idx (status),
  ADD CONSTRAINT mashoor_vendor_companies_removed_by_fk FOREIGN KEY (removed_by) REFERENCES mashoor_staff_users (id),
  ADD CONSTRAINT mashoor_vendor_companies_status_chk CHECK (status IN ('active', 'suspended', 'removed')),
  ADD CONSTRAINT mashoor_vendor_companies_removed_chk CHECK (
    (status = 'removed' AND removed_at IS NOT NULL AND removed_by IS NOT NULL)
    OR (status <> 'removed' AND removed_at IS NULL AND removed_by IS NULL)
  );

INSERT INTO mashoor_schema_migrations (version, name) VALUES (9, '0009_vendor_company_removal');
