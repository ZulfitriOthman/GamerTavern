-- =============================================================================
-- 005 · Guestbook greetings ("Leave Your Wishes")
--
-- New greetings are 'pending' unless auto-approve is switched on in settings.
-- Only 'approved' greetings are returned by the public API.
-- content_hash = SHA-256 of normalised name + message; the UNIQUE key blocks
-- duplicate submissions (including re-posting something marked as spam).
--
-- Rules enforced in API code instead of CHECK constraints:
--   * name 1–80 chars; message 2–1000 chars; relationship ≤ 60 chars
-- =============================================================================

CREATE TABLE IF NOT EXISTS wedding_greetings (
  id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name         VARCHAR(80)   NOT NULL,
  relationship VARCHAR(60)   NULL,
  message      VARCHAR(1000) NOT NULL,
  status       ENUM('pending','approved','hidden','spam') NOT NULL DEFAULT 'pending',
  content_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wedding_greetings_content (content_hash),
  KEY idx_wedding_greetings_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO wedding_schema_migrations (version, description)
VALUES ('005', 'Create wedding_greetings');
