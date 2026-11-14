-- ================================================================
-- Mashoor migration 0004 — vendor password changes become optional
-- (SQLite, NOT MySQL)
-- ================================================================
-- Vendors now keep using the password staff gave them (at creation, reset or
-- reactivation) until they or staff change it; changing it is voluntary
-- (portal → Settings). The backend no longer sets or reads
-- VENDOR_USERS.MUST_CHANGE_PASSWORD.
--
-- Targeted and non-destructive: only the flag is cleared, only on rows where
-- it is set. No row, password hash, session, category assignment or other
-- column is touched. The column itself is kept (always 0 from now on) so no
-- table rebuild is needed and older backups stay schema-compatible.

UPDATE vendor_users SET must_change_password = 0 WHERE must_change_password = 1;
