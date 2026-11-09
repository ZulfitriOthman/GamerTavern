// Backend/routes/api/attendance.routes.js
//
// Attendent mobile app (Phone/Attendent/attendent) — tournament check-in.
//
// Business rules (confirmed by the project owner, 2026-11-09):
//   - What:  people check in to a TOURNAMENT, via their existing
//            TOURNAMENT_REGISTRATIONS row (account holder or guest).
//   - Who:   an ADMIN performs the check-in on the attendee's behalf.
//            Identity always comes from the verified JWT (req.user.sub),
//            never from the request body.
//   - Dupes: ONE check-in per registration, enforced by
//            UNIQUE(PHONE_TOURNAMENT_CHECKINS.REGISTRATION_ID). A repeat
//            (retry / double tap / second device) returns 200 with
//            alreadyCheckedIn: true and the ORIGINAL check-in time + admin,
//            and never writes a second row. A first check-in returns 201.
//
// Concurrency: the registration row is locked (SELECT ... FOR UPDATE) for
// the whole transaction, so concurrent check-ins for the same registration
// serialize; the unique key is the backstop if anything slips past.
//
// Mirrors ticketing.routes.js / admin.routes.js conventions: requireAuth +
// admin role guard, { success, code, message, data } envelope, parameterized
// SQL only, best-effort audit logging. See Database/migrations/0010.
import { Router } from "express";
import { requireAuth } from "../../modules/restAuth.module.js";
import { writeAuditLog } from "../../modules/auditLog.module.js";

function requireAdmin(req, res, next) {
  if (String(req.user?.role || "").toUpperCase() !== "ADMIN") {
    return res.status(403).json({ success: false, code: "ADMIN_REQUIRED", message: "Admin privileges required." });
  }
  next();
}

// Tournament states in which check-in is allowed. 'closed' = registration
// closed, which is the normal state on event day.
const CHECKIN_TOURNAMENT_STATUSES = ["open", "closed"];
// Registration states that may be checked in ('checked_in' only matters for
// legacy rows that have the status but no PHONE_ record — see below).
const CHECKIN_REGISTRATION_STATUSES = ["registered", "checked_in"];

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toCheckinDto(row) {
  return {
    registrationId: row.REGISTRATION_ID,
    tournamentId: row.TOURNAMENT_ID,
    checkedInAt: row.CHECKED_IN_AT,
    checkedInBy: row.CHECKED_IN_BY_NAME ?? null,
  };
}

async function loadCheckin(executor, registrationId) {
  const [rows] = await executor.query(
    `SELECT c.REGISTRATION_ID, c.TOURNAMENT_ID, c.CHECKED_IN_AT, u.NAME AS CHECKED_IN_BY_NAME
       FROM PHONE_TOURNAMENT_CHECKINS c
       LEFT JOIN USERS u ON u.ID = c.CHECKED_IN_BY_USER_ID
      WHERE c.REGISTRATION_ID = ?
      LIMIT 1`,
    [registrationId]
  );
  return rows[0] || null;
}

export default function createAttendanceRoutes({ db }) {
  const router = Router();
  router.use(requireAuth, requireAdmin);

  // Tournaments an admin can currently check people in to, with live counts.
  router.get("/tournaments", async (_req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT t.ID, t.NAME, t.STATUS, t.START_DATE, t.LOCATION, t.REGISTRATION_TYPE,
                g.NAME AS GAME_NAME,
                (SELECT COUNT(*) FROM TOURNAMENT_REGISTRATIONS r
                  WHERE r.TOURNAMENT_ID = t.ID AND r.STATUS IN ('registered', 'checked_in')) AS ELIGIBLE_COUNT,
                (SELECT COUNT(*) FROM PHONE_TOURNAMENT_CHECKINS c WHERE c.TOURNAMENT_ID = t.ID) AS CHECKED_IN_COUNT
           FROM TOURNAMENTS t
           LEFT JOIN ESPORTS_GAMES g ON g.ID = t.ESPORTS_GAME_ID
          WHERE t.STATUS IN (?)
          ORDER BY (t.START_DATE IS NULL), t.START_DATE ASC, t.ID ASC`,
        [CHECKIN_TOURNAMENT_STATUSES]
      );
      return res.json({
        success: true,
        data: rows.map((t) => ({
          id: t.ID,
          name: t.NAME,
          status: t.STATUS,
          startDate: t.START_DATE,
          location: t.LOCATION,
          registrationType: t.REGISTRATION_TYPE,
          gameName: t.GAME_NAME,
          eligibleCount: Number(t.ELIGIBLE_COUNT),
          checkedInCount: Number(t.CHECKED_IN_COUNT),
        })),
      });
    } catch (err) {
      console.error("[attendance/tournaments] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load tournaments." });
    }
  });

  // Roster for one tournament with each registration's check-in state.
  // Never returns emails or other PII beyond display names.
  router.get("/tournaments/:tournamentId/registrations", async (req, res) => {
    const tournamentId = parseId(req.params.tournamentId);
    if (!tournamentId) {
      return res.status(400).json({ success: false, code: "INVALID_INPUT", message: "Invalid tournamentId." });
    }
    try {
      const [tRows] = await db.query(`SELECT ID, NAME, STATUS FROM TOURNAMENTS WHERE ID = ? LIMIT 1`, [tournamentId]);
      const tournament = tRows[0];
      if (!tournament) {
        return res.status(404).json({ success: false, code: "TOURNAMENT_NOT_FOUND", message: "Tournament not found." });
      }

      const [rows] = await db.query(
        `SELECT r.ID, r.USER_ID, r.GUEST_NAME, r.NICKNAME, r.STATUS, r.REGISTERED_AT,
                u.NAME AS USER_NAME, tm.NAME AS TEAM_NAME,
                c.CHECKED_IN_AT, cb.NAME AS CHECKED_IN_BY_NAME
           FROM TOURNAMENT_REGISTRATIONS r
           LEFT JOIN USERS u ON u.ID = r.USER_ID
           LEFT JOIN TOURNAMENT_TEAM_MEMBERS m ON m.REGISTRATION_ID = r.ID
           LEFT JOIN TOURNAMENT_TEAMS tm ON tm.ID = m.TEAM_ID
           LEFT JOIN PHONE_TOURNAMENT_CHECKINS c ON c.REGISTRATION_ID = r.ID
           LEFT JOIN USERS cb ON cb.ID = c.CHECKED_IN_BY_USER_ID
          WHERE r.TOURNAMENT_ID = ?
          ORDER BY tm.NAME IS NULL, tm.NAME, r.REGISTERED_AT ASC, r.ID ASC`,
        [tournamentId]
      );

      return res.json({
        success: true,
        data: {
          tournament: { id: tournament.ID, name: tournament.NAME, status: tournament.STATUS },
          checkInOpen: CHECKIN_TOURNAMENT_STATUSES.includes(tournament.STATUS),
          registrations: rows.map((r) => ({
            id: r.ID,
            displayName: r.NICKNAME || r.USER_NAME || r.GUEST_NAME || `Registration #${r.ID}`,
            name: r.USER_NAME || r.GUEST_NAME || null,
            nickname: r.NICKNAME,
            isGuest: r.USER_ID == null,
            teamName: r.TEAM_NAME,
            status: r.STATUS,
            eligible: CHECKIN_REGISTRATION_STATUSES.includes(r.STATUS),
            checkedInAt: r.CHECKED_IN_AT,
            checkedInBy: r.CHECKED_IN_BY_NAME ?? null,
          })),
        },
      });
    } catch (err) {
      console.error("[attendance/registrations] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load registrations." });
    }
  });

  // The primary action. Idempotent: see header for the duplicate contract.
  router.post("/tournaments/:tournamentId/registrations/:registrationId/check-in", async (req, res) => {
    const tournamentId = parseId(req.params.tournamentId);
    const registrationId = parseId(req.params.registrationId);
    if (!tournamentId || !registrationId) {
      return res.status(400).json({ success: false, code: "INVALID_INPUT", message: "Invalid tournamentId or registrationId." });
    }
    // Identity/target come only from the JWT + path; reject anything else
    // rather than silently ignoring a client that thinks it can set them.
    if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) {
      return res.status(400).json({ success: false, code: "INVALID_INPUT", message: "This endpoint takes no request body." });
    }

    const adminUserId = req.user.sub;
    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      // Lock ONLY the registration row (not the tournament) so check-ins
      // for different people never block each other.
      const [regRows] = await conn.query(
        `SELECT ID, TOURNAMENT_ID, STATUS FROM TOURNAMENT_REGISTRATIONS
          WHERE ID = ? AND TOURNAMENT_ID = ? FOR UPDATE`,
        [registrationId, tournamentId]
      );
      const registration = regRows[0];
      if (!registration) {
        await conn.rollback();
        return res.status(404).json({ success: false, code: "REGISTRATION_NOT_FOUND", message: "Registration not found for this tournament." });
      }

      // Repeat submission → original record, regardless of later state changes.
      const existing = await loadCheckin(conn, registrationId);
      if (existing) {
        await conn.commit();
        return res.status(200).json({ success: true, code: "ALREADY_CHECKED_IN", message: "Already checked in.", data: { alreadyCheckedIn: true, checkIn: toCheckinDto(existing) } });
      }

      const [tRows] = await conn.query(`SELECT STATUS FROM TOURNAMENTS WHERE ID = ? LIMIT 1`, [tournamentId]);
      if (!CHECKIN_TOURNAMENT_STATUSES.includes(tRows[0]?.STATUS)) {
        await conn.rollback();
        return res.status(409).json({
          success: false,
          code: "TOURNAMENT_NOT_ACTIVE",
          message: `Check-in is not available while the tournament is ${tRows[0]?.STATUS ?? "unavailable"}.`,
        });
      }
      if (!CHECKIN_REGISTRATION_STATUSES.includes(registration.STATUS)) {
        await conn.rollback();
        return res.status(409).json({
          success: false,
          code: "REGISTRATION_NOT_ELIGIBLE",
          message: `This registration is ${registration.STATUS} and cannot be checked in.`,
        });
      }

      try {
        await conn.query(
          `INSERT INTO PHONE_TOURNAMENT_CHECKINS (TOURNAMENT_ID, REGISTRATION_ID, CHECKED_IN_BY_USER_ID) VALUES (?, ?, ?)`,
          [tournamentId, registrationId, adminUserId]
        );
      } catch (err) {
        if (err?.code === "ER_DUP_ENTRY") {
          // Backstop: a concurrent request won the race. Return its record.
          await conn.rollback();
          const winner = await loadCheckin(db, registrationId);
          if (winner) {
            return res.status(200).json({ success: true, code: "ALREADY_CHECKED_IN", message: "Already checked in.", data: { alreadyCheckedIn: true, checkIn: toCheckinDto(winner) } });
          }
        }
        throw err;
      }

      // Keep the existing schema's own status semantics in sync (web UI reads it).
      await conn.query(
        `UPDATE TOURNAMENT_REGISTRATIONS SET STATUS = 'checked_in' WHERE ID = ? AND STATUS = 'registered'`,
        [registrationId]
      );

      await conn.commit();

      const created = await loadCheckin(db, registrationId);
      await writeAuditLog(db, {
        actorUserId: adminUserId,
        action: "TOURNAMENT_CHECKIN",
        entityType: "tournament_registration",
        entityId: registrationId,
        metadata: { tournamentId },
      });
      return res.status(201).json({ success: true, code: "CHECKED_IN", message: "Checked in.", data: { alreadyCheckedIn: false, checkIn: toCheckinDto(created) } });
    } catch (err) {
      try {
        await conn?.rollback();
      } catch {
        /* connection may already be closed */
      }
      console.error("[attendance/check-in] error:", err);
      return res.status(500).json({ success: false, message: "Failed to check in." });
    } finally {
      conn?.release();
    }
  });

  return router;
}
