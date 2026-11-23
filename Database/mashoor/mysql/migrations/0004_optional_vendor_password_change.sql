-- Mashoor migration 0004 — changing a staff-set password is optional for vendors
-- (MySQL / MariaDB). Data only: clears any pending forced change.

UPDATE mashoor_vendor_users SET must_change_password = 0 WHERE must_change_password = 1;

INSERT INTO mashoor_schema_migrations (version, name) VALUES (4, '0004_optional_vendor_password_change');
