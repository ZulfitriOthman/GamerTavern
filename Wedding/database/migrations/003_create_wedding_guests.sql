-- =============================================================================
-- 003 · Invited guests / households
--
-- Each row is one invitation (a person or household) with a seat limit and a
-- private RSVP link. Only the SHA-256 hash of the link token is stored, so a
-- database leak does not reveal working RSVP links. The plain token is shown
-- to the admin once, when the link is generated; generating a new link
-- replaces the hash and invalidates the old link.
--
-- Rules enforced in API code instead of CHECK constraints:
--   * name 1–120 chars; max_party_size 1–20; email format
-- =============================================================================

CREATE TABLE IF NOT EXISTS wedding_guests (
  id                CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name              VARCHAR(120) NOT NULL,
  email             VARCHAR(254) NULL,
  phone             VARCHAR(40)  NULL,
  max_party_size    TINYINT UNSIGNED NOT NULL DEFAULT 2,
  notes             VARCHAR(1000) NULL,
  invite_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  invite_created_at DATETIME     NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wedding_guests_token (invite_token_hash),
  KEY idx_wedding_guests_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO wedding_schema_migrations (version, description)
VALUES ('003', 'Create wedding_guests');
