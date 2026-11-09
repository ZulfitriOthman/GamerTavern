-- ================================================================
-- Migration 0010 — Attendent mobile app: tournament check-in record
-- ================================================================
-- The Attendent phone app (Phone/Attendent/attendent) lets an ADMIN
-- check registered participants (account holders AND guests) in to a
-- tournament. See Backend/routes/api/attendance.routes.js.
--
-- REUSED, NOT DUPLICATED:
--   TOURNAMENTS              — what people check in to.
--   TOURNAMENT_REGISTRATIONS — who checks in. Its STATUS column already
--                              defines 'checked_in' (007_content_community.sql);
--                              the check-in endpoint flips registered -> checked_in
--                              in the same transaction as the insert below.
--   USERS                    — the admin who performed the check-in.
--   AUDIT_LOGS               — TOURNAMENT_CHECKIN action, best-effort.
--
-- WHY ONE NEW TABLE (PHONE_ prefix — new table owned by the phone app):
--   TOURNAMENT_REGISTRATIONS has no "when" or "by whom" column, and a
--   status flag alone can't carry either. Rather than ALTER a live,
--   high-blast-radius table used by tournament.controller.js, the
--   check-in fact lives in its own row, and UNIQUE(REGISTRATION_ID)
--   enforces the confirmed business rule at the database level:
--   ONE check-in per registration (= one person, one tournament).
--   Retries and concurrent submissions can never insert a second row.
--
-- The composite FK (REGISTRATION_ID, TOURNAMENT_ID) reuses the existing
-- UQ_REGISTRATIONS_ID_TOURNAMENT candidate key (same pattern as
-- TOURNAMENT_TEAM_MEMBERS), so a check-in can never point at a
-- registration from a different tournament. ON DELETE CASCADE keeps the
-- existing tournament:leave / tournament:delete flows (which DELETE
-- registrations) working unchanged.
--
-- Purely additive, idempotent (IF NOT EXISTS), safe to re-run.
-- No existing table or row is modified by this migration.
-- ================================================================

-- Select your NanashiCollectibles/GamerTavern database before running this script.
-- USE `nanashi_collectibles`;

CREATE TABLE IF NOT EXISTS PHONE_TOURNAMENT_CHECKINS (
  ID                     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  TOURNAMENT_ID          INT UNSIGNED NOT NULL,             -- redundant by design: lets the composite FK below be enforced by MySQL itself
  REGISTRATION_ID        INT UNSIGNED NOT NULL,
  CHECKED_IN_BY_USER_ID  INT UNSIGNED NULL,                 -- admin who performed the check-in
  CHECKED_IN_AT          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_PHONE_CHECKINS_REGISTRATION
    FOREIGN KEY (REGISTRATION_ID, TOURNAMENT_ID)
    REFERENCES TOURNAMENT_REGISTRATIONS(ID, TOURNAMENT_ID) ON DELETE CASCADE,
  CONSTRAINT FK_PHONE_CHECKINS_CHECKED_IN_BY
    FOREIGN KEY (CHECKED_IN_BY_USER_ID) REFERENCES USERS(ID) ON DELETE SET NULL,
  UNIQUE KEY UQ_PHONE_CHECKINS_REGISTRATION (REGISTRATION_ID),   -- the duplicate guard: one check-in per registration, ever
  INDEX IDX_PHONE_CHECKINS_TOURNAMENT (TOURNAMENT_ID, CHECKED_IN_AT)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
