-- =============================================================================
-- 002 · Wedding events (Majlis Bersanding, Akad Nikah, …)
--
-- Prefixed `wedding_` because the shared database already has an unrelated
-- `events` table (GamerTavern ticketing).
--
-- Dates/times are wall-clock values at the venue (settings.timezone).
-- `programme` is a JSON array stored as LONGTEXT:
--   [{"time":"13:30","endTime":"14:15","title":"Menerima Jemputan"}, ...]
-- `capacity` NULL = unlimited.
--
-- Rules enforced in API code instead of CHECK constraints:
--   * title 1–100 chars; maps_url must start with https://
--   * max_party_size 1–20; capacity > 0 when set
-- =============================================================================

CREATE TABLE IF NOT EXISTS wedding_events (
  id             CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  title          VARCHAR(100)  NOT NULL,
  description    TEXT          NULL,
  event_date     DATE          NULL,
  start_time     TIME          NULL,
  end_time       TIME          NULL,
  venue_name     VARCHAR(150)  NULL,
  address        VARCHAR(300)  NULL,
  maps_url       VARCHAR(600)  NULL,
  dress_code     VARCHAR(300)  NULL,
  programme      LONGTEXT      NOT NULL,
  rsvp_enabled   TINYINT(1)    NOT NULL DEFAULT 1,
  capacity       INT UNSIGNED  NULL,
  max_party_size TINYINT UNSIGNED NOT NULL DEFAULT 4,
  is_published   TINYINT(1)    NOT NULL DEFAULT 1,
  sort_order     INT           NOT NULL DEFAULT 0,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wedding_events_order (is_published, sort_order, event_date, start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO wedding_schema_migrations (version, description)
VALUES ('002', 'Create wedding_events');
