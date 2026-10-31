-- =============================================================================
-- 000 · Migration tracking
-- Records which wedding migration scripts have been run against this database.
-- Every later migration inserts its own version here as its final statement,
-- so `SELECT * FROM wedding_schema_migrations` shows exactly what is installed.
--
-- Engine: MySQL 5.7+ / MariaDB 10.3+ (same conventions as Database/README.md).
-- Safe to re-run: uses IF NOT EXISTS / INSERT IGNORE only.
-- =============================================================================

CREATE TABLE IF NOT EXISTS wedding_schema_migrations (
  version     VARCHAR(64)  NOT NULL,
  description VARCHAR(255) NOT NULL,
  applied_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO wedding_schema_migrations (version, description)
VALUES ('000', 'Create wedding_schema_migrations');
