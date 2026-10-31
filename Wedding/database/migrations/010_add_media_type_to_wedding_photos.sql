-- =============================================================================
-- 010 · Photos, GIFs and videos in wedding_photos
--
-- Adds two columns to the EXISTING wedding_photos table (no new table):
--   media_type  'image' | 'gif' | 'video'
--   mime_type   the stored file's real content type (image/jpeg, image/gif,
--               video/mp4, video/webm) — detected from the file signature by the
--               API, never taken from the browser.
-- Every existing row becomes media_type='image', mime_type='image/jpeg', which
-- is exactly what was stored before. No existing data is modified otherwise:
-- statuses (pending / approved / rejected) are left as they are.
--
-- Non-destructive and safe to re-run: each column is added only if missing.
-- Works on MySQL 5.7+ / 8 and MariaDB 10.3+.
--
-- The API keeps working before this is run (photo uploads only); GIF and video
-- uploads are enabled once these columns exist.
-- =============================================================================

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'wedding_photos' AND column_name = 'media_type'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE wedding_photos ADD COLUMN media_type ENUM(''image'',''gif'',''video'') NOT NULL DEFAULT ''image'' AFTER thumb_key',
  'SELECT ''media_type already present'' AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'wedding_photos' AND column_name = 'mime_type'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE wedding_photos ADD COLUMN mime_type VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT ''image/jpeg'' AFTER media_type',
  'SELECT ''mime_type already present'' AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO wedding_schema_migrations (version, description)
VALUES ('010', 'Add media_type and mime_type to wedding_photos (GIF and video support)');

-- Verify (expected: media_type and mime_type listed):
SELECT column_name, column_type, column_default
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'wedding_photos' AND column_name IN ('media_type', 'mime_type');
