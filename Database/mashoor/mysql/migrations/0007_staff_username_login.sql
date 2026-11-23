-- Mashoor MySQL migration 0007 — admin (staff) accounts can sign in with a username
-- (MariaDB 10.6 / MySQL; see 0001 for conventions). MySQL-only: there is no
-- SQLite counterpart.
--
--   * mashoor_staff_users gains USERNAME, with the same rules as vendor
--     usernames: unique case-insensitively (utf8mb4_unicode_ci) and stored only
--     in the canonical lower-case, trimmed form (byte-wise CHECK). The backend
--     allows 3–40 of a-z 0-9 . _ - , starting with a letter or digit.
--   * EMAIL becomes optional (an account created with a username only has
--     none); it stays unique when present. Every account must keep at least
--     one of the two so it can sign in.
--   * Existing accounts are not changed: they keep signing in with their email
--     (username NULL until set).

ALTER TABLE mashoor_staff_users
  ADD COLUMN username VARCHAR(40) NULL AFTER id,
  MODIFY COLUMN email VARCHAR(254) NULL,
  ADD UNIQUE KEY mashoor_staff_users_username_uq (username),
  ADD CONSTRAINT mashoor_staff_users_username_chk CHECK (username IS NULL OR CAST(username AS BINARY) = CAST(LOWER(TRIM(username)) AS BINARY)),
  ADD CONSTRAINT mashoor_staff_users_login_chk CHECK (username IS NOT NULL OR email IS NOT NULL);

INSERT INTO mashoor_schema_migrations (version, name) VALUES (7, '0007_staff_username_login');
