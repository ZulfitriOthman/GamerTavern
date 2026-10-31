-- =============================================================================
-- 004 · RSVP responses — one row per party per event
--
-- Duplicate prevention: UNIQUE (event_id, dedupe_hash). The hash is SHA-256 of
--   'guest:<guest id>'          for personal invitation links (updates in place)
--   'email:<lower email>'       for open RSVPs with an email
--   'phone:<digits>'            for open RSVPs with only a phone number
--   'name:<normalised name>'    otherwise
-- Open RSVPs can never overwrite an existing reply; invitation links can.
--
-- Rules enforced in API code instead of CHECK constraints:
--   * attending = 1  => party_size between 1 and the event/guest limit
--   * attending = 0  => party_size = 0
--   * event capacity (checked inside a transaction with the event row locked)
-- =============================================================================

CREATE TABLE IF NOT EXISTS wedding_rsvps (
  id          CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_id    CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  guest_id    CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  name        VARCHAR(120)  NOT NULL,
  email       VARCHAR(254)  NULL,
  phone       VARCHAR(40)   NULL,
  attending   TINYINT(1)    NOT NULL,
  party_size  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  message     VARCHAR(1000) NULL,
  dedupe_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source      ENUM('open','invite','admin') NOT NULL DEFAULT 'open',
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wedding_rsvps_party_event (event_id, dedupe_hash),
  KEY idx_wedding_rsvps_event_attending (event_id, attending),
  KEY idx_wedding_rsvps_guest (guest_id),
  KEY idx_wedding_rsvps_created (created_at),
  CONSTRAINT fk_wedding_rsvps_event FOREIGN KEY (event_id)
    REFERENCES wedding_events (id) ON DELETE CASCADE,
  CONSTRAINT fk_wedding_rsvps_guest FOREIGN KEY (guest_id)
    REFERENCES wedding_guests (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO wedding_schema_migrations (version, description)
VALUES ('004', 'Create wedding_rsvps');
