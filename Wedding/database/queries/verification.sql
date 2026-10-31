-- =============================================================================
-- Verification queries — read-only. Run after the migrations and seed.
-- Every query here is a SELECT; nothing is modified.
-- =============================================================================

-- 1. Engine version (expected: MariaDB 10.3+ or MySQL 5.7+)
SELECT VERSION() AS server_version;

-- 2. Which wedding migrations have been applied (expected: 000 … 009)
SELECT version, description, applied_at FROM wedding_schema_migrations ORDER BY version;

-- 3. All wedding tables exist, InnoDB, utf8mb4 (expected: 11 rows)
SELECT table_name, engine, table_collation
FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_name LIKE 'wedding\_%'
ORDER BY table_name;

-- 4. Foreign keys (expected: rsvps→events, rsvps→guests, photos→albums, sessions→admins)
SELECT table_name, constraint_name, referenced_table_name, delete_rule
FROM information_schema.referential_constraints
WHERE constraint_schema = DATABASE() AND table_name LIKE 'wedding\_%'
ORDER BY table_name;

-- 5. Seeded wedding information
SELECT id, wedding_date, wedding_time, timezone, rsvp_mode, rsvp_deadline,
       greetings_enabled, photo_uploads_enabled, CHAR_LENGTH(content) AS content_chars
FROM wedding_settings;

SELECT title, event_date, start_time, end_time, venue_name, address, max_party_size, capacity, is_published
FROM wedding_events ORDER BY sort_order;

SELECT slug, title, is_public, is_guest_uploads FROM wedding_albums ORDER BY sort_order;

-- 6. Exactly one album receives guest uploads (expected: 1)
SELECT COUNT(*) AS guest_upload_albums FROM wedding_albums WHERE is_guest_uploads = 1;

-- 7. Administrators (never shows password hashes)
SELECT email, display_name, is_active, last_login_at, created_at FROM wedding_admins;

-- 8. Activity overview
SELECT
  (SELECT COUNT(*) FROM wedding_guests)                                 AS invited_parties,
  (SELECT COUNT(*) FROM wedding_rsvps)                                  AS rsvp_rows,
  (SELECT COALESCE(SUM(party_size), 0) FROM wedding_rsvps WHERE attending = 1) AS expected_attendees,
  (SELECT COUNT(*) FROM wedding_greetings WHERE status = 'pending')    AS pending_greetings,
  (SELECT COUNT(*) FROM wedding_photos WHERE status = 'pending')       AS pending_photos;
