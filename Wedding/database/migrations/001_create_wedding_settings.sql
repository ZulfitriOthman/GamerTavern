-- =============================================================================
-- 001 · Site settings (single row, id = 1)
--
-- Typed columns hold the rules the API enforces (RSVP mode, deadline,
-- moderation switches). `content` holds the editable website wording as a
-- JSON document stored in LONGTEXT (no native JSON type, for MariaDB/MySQL 5.7
-- compatibility); the API validates it is a JSON object before saving.
--
-- Rules enforced in API code instead of CHECK constraints:
--   * id must be 1 (the API only ever reads/writes id = 1)
--   * timezone must be a valid IANA zone name
-- =============================================================================

CREATE TABLE IF NOT EXISTS wedding_settings (
  id                     TINYINT UNSIGNED NOT NULL DEFAULT 1,
  wedding_date           DATE         NULL,
  wedding_time           TIME         NULL,
  timezone               VARCHAR(64)  NOT NULL DEFAULT 'Asia/Brunei',
  rsvp_mode              ENUM('open','invite_only','closed') NOT NULL DEFAULT 'open',
  rsvp_deadline          DATE         NULL,
  greetings_enabled      TINYINT(1)   NOT NULL DEFAULT 1,
  greetings_auto_approve TINYINT(1)   NOT NULL DEFAULT 0,
  photo_uploads_enabled  TINYINT(1)   NOT NULL DEFAULT 1,
  content                LONGTEXT     NOT NULL,
  created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO wedding_schema_migrations (version, description)
VALUES ('001', 'Create wedding_settings');
