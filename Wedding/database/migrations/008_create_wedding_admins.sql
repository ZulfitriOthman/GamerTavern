-- =============================================================================
-- 008 · Wedding administrators and their sessions
--
-- Deliberately separate from GamerTavern's USERS table: a wedding admin has no
-- rights in the marketplace and vice versa. There is no public registration;
-- admins are created with `npm run create-admin` in Wedding/server, which
-- hashes the password with bcrypt (no plain-text passwords in SQL files).
--
-- Sessions: the browser holds a random token in an HttpOnly cookie; only its
-- SHA-256 hash is stored here (`id`). Logging out or expiry deletes the row.
-- csrf_token is returned to the signed-in admin and must accompany every
-- state-changing admin request (X-CSRF-Token header).
-- =============================================================================

CREATE TABLE IF NOT EXISTS wedding_admins (
  id            CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  email         VARCHAR(254) NOT NULL,
  display_name  VARCHAR(80)  NULL,
  password_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wedding_admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wedding_admin_sessions (
  id           CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  admin_id     CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  csrf_token   CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at   DATETIME     NOT NULL,
  last_seen_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_agent   VARCHAR(255) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wedding_admin_sessions_admin (admin_id),
  KEY idx_wedding_admin_sessions_expiry (expires_at),
  CONSTRAINT fk_wedding_admin_sessions_admin FOREIGN KEY (admin_id)
    REFERENCES wedding_admins (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO wedding_schema_migrations (version, description)
VALUES ('008', 'Create wedding_admins and wedding_admin_sessions');
