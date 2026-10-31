-- =============================================================================
-- 007 · Photos (metadata only — image files live on disk/object storage)
--
-- storage_key / thumb_key are RELATIVE identifiers such as
--   'photos/2027-01/3f2b…e1.jpg'
-- resolved by the API against its configured upload directory. Never absolute
-- machine paths, never user-supplied names.
--
-- Visibility: the public API serves a photo only when status = 'approved' and
-- its album (if any) is public. Pending/rejected files are served only to a
-- signed-in admin.
--
-- Rules enforced in API code instead of CHECK constraints:
--   * guest uploads require consent_at
-- =============================================================================

CREATE TABLE IF NOT EXISTS wedding_photos (
  id            CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  album_id      CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  storage_key   VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  thumb_key     VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  caption       VARCHAR(300) NULL,
  uploader_name VARCHAR(80)  NULL,
  source        ENUM('official','guest') NOT NULL DEFAULT 'official',
  status        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  width         SMALLINT UNSIGNED NULL,
  height        SMALLINT UNSIGNED NULL,
  byte_size     INT UNSIGNED NOT NULL DEFAULT 0,
  sort_order    INT          NOT NULL DEFAULT 0,
  consent_at    DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wedding_photos_storage (storage_key),
  KEY idx_wedding_photos_public (status, album_id, sort_order, created_at),
  CONSTRAINT fk_wedding_photos_album FOREIGN KEY (album_id)
    REFERENCES wedding_albums (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO wedding_schema_migrations (version, description)
VALUES ('007', 'Create wedding_photos');
