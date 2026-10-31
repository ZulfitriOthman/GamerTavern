-- =============================================================================
-- 006 · Photo albums
--
-- Rules enforced in API code instead of CHECK constraints / partial indexes:
--   * slug matches ^[a-z0-9]+(-[a-z0-9]+)*$
--   * at most one album has is_guest_uploads = 1 (switched inside a transaction)
-- =============================================================================

CREATE TABLE IF NOT EXISTS wedding_albums (
  id               CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  slug             VARCHAR(60)  CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  title            VARCHAR(80)  NOT NULL,
  description      VARCHAR(500) NULL,
  is_public        TINYINT(1)   NOT NULL DEFAULT 1,
  is_guest_uploads TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order       INT          NOT NULL DEFAULT 0,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wedding_albums_slug (slug),
  KEY idx_wedding_albums_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO wedding_schema_migrations (version, description)
VALUES ('006', 'Create wedding_albums');
