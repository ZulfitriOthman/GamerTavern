-- =============================================================================
-- Record migrations 000–009 as applied
--
-- Use this ONLY if all eleven wedding_* tables already exist but
-- `SELECT * FROM wedding_schema_migrations` returns no rows. That happens when
-- the migration files are run with MySQL Workbench's auto-commit switched OFF:
-- CREATE TABLE commits automatically, but the INSERT at the end of each file is
-- rolled back when the tab/connection closes.
--
-- It only inserts tracking rows (INSERT IGNORE — safe to run more than once).
-- It does not create, change or delete any table or data.
-- =============================================================================

START TRANSACTION;

INSERT IGNORE INTO wedding_schema_migrations (version, description) VALUES
  ('000', 'Create wedding_schema_migrations'),
  ('001', 'Create wedding_settings'),
  ('002', 'Create wedding_events'),
  ('003', 'Create wedding_guests'),
  ('004', 'Create wedding_rsvps'),
  ('005', 'Create wedding_greetings'),
  ('006', 'Create wedding_albums'),
  ('007', 'Create wedding_photos'),
  ('008', 'Create wedding_admins and wedding_admin_sessions'),
  ('009', 'Create wedding_rate_limits');

COMMIT;

-- Expected: 10 rows, 000 … 009
SELECT version, description, applied_at FROM wedding_schema_migrations ORDER BY version;
