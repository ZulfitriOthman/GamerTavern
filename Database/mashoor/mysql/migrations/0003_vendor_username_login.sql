-- Mashoor migration 0003 — vendors sign in with a username, not an email
-- (MySQL / MariaDB; see 0001 for conventions).
--
-- Existing accounts get username NULL (they cannot sign in until staff set
-- one). Email becomes optional and no longer unique.
-- Usernames:
--   * utf8mb4_unicode_ci (the table's collation): the unique index is
--     case-insensitive, so 'Alice' and 'alice' can never both exist — the
--     case-insensitive uniqueness the SQLite schema intended;
--   * the CHECK compares bytes, so only the canonical lower-case, trimmed
--     form the backend writes can be stored.

ALTER TABLE mashoor_vendor_users
  ADD COLUMN username VARCHAR(40) NULL AFTER company_id,
  MODIFY COLUMN email VARCHAR(254) NULL,
  DROP INDEX mashoor_vendor_users_email_uq,
  ADD UNIQUE KEY mashoor_vendor_users_username_uq (username),
  ADD CONSTRAINT mashoor_vendor_users_username_chk CHECK (username IS NULL OR CAST(username AS BINARY) = CAST(LOWER(TRIM(username)) AS BINARY));

INSERT INTO mashoor_schema_migrations (version, name) VALUES (3, '0003_vendor_username_login');
