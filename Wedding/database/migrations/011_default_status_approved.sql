-- =============================================================================
-- 011 · New guest wishes and media default to 'approved' (published)
--
-- The API already stores every valid new wish / upload as 'approved' explicitly
-- (server/src/services/greetings.js and photos.js). This aligns the column
-- DEFAULT with that policy, so any insert that omits `status` is also public.
--
-- Changes the DEFAULT only. Existing rows are NOT modified — pending, hidden,
-- spam and rejected records keep their current status.
-- Allowed values are unchanged:
--   wedding_greetings.status  ENUM('pending','approved','hidden','spam')
--   wedding_photos.status     ENUM('pending','approved','rejected')
--
-- Safe to re-run. MySQL 5.7+ / 8 and MariaDB 10.3+.
-- =============================================================================

ALTER TABLE wedding_greetings ALTER COLUMN status SET DEFAULT 'approved';
ALTER TABLE wedding_photos    ALTER COLUMN status SET DEFAULT 'approved';

INSERT IGNORE INTO wedding_schema_migrations (version, description)
VALUES ('011', 'Default status approved for wedding_greetings and wedding_photos');

-- Verify (expected: both rows show 'approved' as the default):
SELECT table_name, column_name, column_default
FROM information_schema.columns
WHERE table_schema = DATABASE() AND column_name = 'status'
  AND table_name IN ('wedding_greetings', 'wedding_photos');
