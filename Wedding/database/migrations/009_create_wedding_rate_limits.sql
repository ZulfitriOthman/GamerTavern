-- =============================================================================
-- 009 · Rate-limit events
--
-- Sliding-window rate limiting for guest submissions, uploads and admin login.
-- Stored in MySQL (not process memory) so limits survive restarts and work
-- with more than one API process. Only salted SHA-256 hashes of IP addresses
-- or emails are stored — never the raw values. The API deletes rows older than
-- two days automatically.
-- =============================================================================

CREATE TABLE IF NOT EXISTS wedding_rate_limits (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bucket     VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  key_hash   CHAR(64)    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wedding_rate_limits_lookup (bucket, key_hash, created_at),
  KEY idx_wedding_rate_limits_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO wedding_schema_migrations (version, description)
VALUES ('009', 'Create wedding_rate_limits');
