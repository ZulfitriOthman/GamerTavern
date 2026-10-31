// Backend/controllers/tournament.controller.js
//
// Migrated to the NanashiCollectibles v2 schema: TOURNAMENT -> tournaments,
// PARTICIPANTS -> tournament_registrations, plus the new tournament_teams /
// tournament_team_members structure for real (not free-text) team registration,
// and esports_games as the data-driven game list (GAME_TITLE string -> esports_game_id FK).

import { sendBulkEmail } from "../modules/mailer.module.js";
import { requireAdmin } from "../modules/authz.module.js";

const toStr = (v) => (v == null ? "" : String(v)).trim();
const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const OPEN_STATUS = "open";
const VALID_STATUS_TRANSITIONS = {
  draft: ["open", "cancelled"],
  open: ["closed", "cancelled"],
  closed: ["open", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

function slugify(name) {
  return toStr(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 260);
}

function safeTournamentRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    esports_game_id: row.esports_game_id,
    esports_game_name: row.esports_game_name ?? null,
    name: row.name,
    slug: row.slug,
    description: row.description,
    start_date: row.start_date,
    end_date: row.end_date,
    location: row.location,
    entry_fee: row.entry_fee,
    game_title: row.esports_game_name ?? null, // deprecated alias for pre-migration frontend consumers
    organizer: row.organizer,
    rules: row.rules,
    registration_deadline: row.registration_deadline,
    registration_type: row.registration_type,
    team_size: row.team_size,
    max_entries: row.max_entries,
    max_teams: row.registration_type === "team" ? row.max_entries : null, // deprecated alias
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const SELECT_TOURNAMENT_SQL = `
  SELECT t.id, t.esports_game_id, g.name AS esports_game_name, t.name, t.slug,
         t.description, t.start_date, t.end_date, t.location, t.entry_fee, t.organizer,
         t.rules, t.registration_deadline, t.registration_type, t.team_size,
         t.max_entries, t.status, t.created_at, t.updated_at
  FROM TOURNAMENTS t
  LEFT JOIN ESPORTS_GAMES g ON g.id = t.esports_game_id
`;

function safeRegistrationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    tournament_id: row.tournament_id,
    user_id: row.user_id,
    guest_name: row.guest_name,
    nickname: row.nickname,
    status: row.status,
    registration_date: row.registered_at, // deprecated alias
    registered_at: row.registered_at,
    user_name: row.user_name,
    user_role: row.user_id ? row.user_role : "GUEST",
  };
}

async function fetchRegistrationsByTournamentIds(db, ids) {
  if (!ids || ids.length === 0) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await db.execute(
    `SELECT r.id, r.tournament_id, r.user_id, r.guest_name, r.nickname, r.status,
            r.registered_at, u.name AS user_name, u.role AS user_role
     FROM TOURNAMENT_REGISTRATIONS r
     LEFT JOIN USERS u ON u.id = r.user_id
     WHERE r.tournament_id IN (${placeholders})
     ORDER BY r.registered_at ASC, r.id ASC`,
    ids
  );
  const map = new Map();
  for (const r of rows || []) {
    const safe = safeRegistrationRow(r);
    if (!map.has(safe.tournament_id)) map.set(safe.tournament_id, []);
    map.get(safe.tournament_id).push(safe);
  }
  return map;
}

async function fetchTeamsByTournamentIds(db, ids) {
  if (!ids || ids.length === 0) return new Map();
  const placeholders = ids.map(() => "?").join(",");

  const [teamRows] = await db.execute(
    `SELECT id, tournament_id, name, captain_registration_id, status, created_at
     FROM TOURNAMENT_TEAMS
     WHERE tournament_id IN (${placeholders})
     ORDER BY created_at ASC, id ASC`,
    ids
  );

  const teamIds = (teamRows || []).map((t) => t.id);
  let membersByTeam = new Map();
  if (teamIds.length > 0) {
    const teamPlaceholders = teamIds.map(() => "?").join(",");
    const [memberRows] = await db.execute(
      `SELECT m.team_id, r.id, r.tournament_id, r.user_id, r.guest_name, r.nickname,
              r.status, r.registered_at, u.name AS user_name, u.role AS user_role
       FROM TOURNAMENT_TEAM_MEMBERS m
       JOIN TOURNAMENT_REGISTRATIONS r ON r.id = m.registration_id
       LEFT JOIN USERS u ON u.id = r.user_id
       WHERE m.team_id IN (${teamPlaceholders})
       ORDER BY m.joined_at ASC, m.id ASC`,
      teamIds
    );
    membersByTeam = new Map();
    for (const r of memberRows || []) {
      if (!membersByTeam.has(r.team_id)) membersByTeam.set(r.team_id, []);
      membersByTeam.get(r.team_id).push(safeRegistrationRow(r));
    }
  }

  const map = new Map();
  for (const t of teamRows || []) {
    if (!map.has(t.tournament_id)) map.set(t.tournament_id, []);
    map.get(t.tournament_id).push({
      id: t.id,
      tournament_id: t.tournament_id,
      name: t.name,
      captain_registration_id: t.captain_registration_id,
      status: t.status,
      created_at: t.created_at,
      members: membersByTeam.get(t.id) || [],
    });
  }
  return map;
}

export default function tournamentSocketController({ socket, io, db }) {
  /* =========================================================
     LIST TOURNAMENTS  (PUBLIC)
     ========================================================= */
  socket.on("tournament:list", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const esportsGameId = payload.esportsGameId != null ? toInt(payload.esportsGameId) : null;
    const status = toStr(payload.status);

    try {
      const where = [];
      const params = [];

      if (esportsGameId) {
        where.push("t.esports_game_id = ?");
        params.push(esportsGameId);
      }
      if (status && status !== "all") {
        where.push("t.status = ?");
        params.push(status);
      }

      const sql = `
        ${SELECT_TOURNAMENT_SQL}
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY t.start_date ASC
      `;

      const [rows] = await db.execute(sql, params);
      const tournaments = (rows || []).map(safeTournamentRow);
      const ids = tournaments.map((t) => t.id);
      const registrationsMap = await fetchRegistrationsByTournamentIds(db, ids);
      const teamsMap = await fetchTeamsByTournamentIds(db, ids);
      for (const t of tournaments) {
        t.participants = registrationsMap.get(t.id) || [];
        t.teams = t.registration_type === "team" ? teamsMap.get(t.id) || [] : [];
      }

      return ack({ success: true, data: tournaments });
    } catch (err) {
      console.error("[tournament:list] error", err);
      return ack({ success: false, message: "Failed to load tournaments." });
    }
  });

  /* =========================================================
     CREATE TOURNAMENT  (ADMIN ONLY)
     ========================================================= */
  socket.on("tournament:create", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const auth = requireAdmin(socket);
    if (!auth.ok) return ack({ success: false, code: auth.code, message: auth.message });

    const name = toStr(payload.name);
    const esportsGameId = toInt(payload.esportsGameId ?? payload.esports_game_id, 0);
    const description = toStr(payload.description);
    const location = toStr(payload.location);
    const rules = toStr(payload.rules);
    const organizer = toStr(payload.organizer) || auth.user.name || "Admin";
    const startRaw = toStr(payload.startDate ?? payload.start_date);
    const endRaw = toStr(payload.endDate ?? payload.end_date);
    const entryFeeRaw = payload.entryFee ?? payload.entry_fee;
    const regDeadlineRaw = toStr(payload.registrationDeadline ?? payload.registration_deadline);
    const registrationType = toStr(payload.registrationType ?? payload.registration_type) || "individual";
    const teamSizeRaw = payload.teamSize ?? payload.team_size;
    const maxEntriesRaw = payload.maxEntries ?? payload.max_entries ?? payload.max_teams;

    if (!name) return ack({ success: false, message: "Name is required." });
    if (!esportsGameId) return ack({ success: false, message: "esportsGameId is required." });
    if (!startRaw) return ack({ success: false, message: "Start date is required." });
    if (!["individual", "team"].includes(registrationType)) {
      return ack({ success: false, message: "registrationType must be 'individual' or 'team'." });
    }

    const startDate = new Date(startRaw);
    if (Number.isNaN(startDate.getTime())) {
      return ack({ success: false, message: "Invalid start date." });
    }
    let endDate = null;
    if (endRaw) {
      endDate = new Date(endRaw);
      if (Number.isNaN(endDate.getTime())) {
        return ack({ success: false, message: "Invalid end date." });
      }
      if (endDate < startDate) {
        return ack({ success: false, message: "End date must be after start date." });
      }
    }
    let regDeadline = null;
    if (regDeadlineRaw) {
      regDeadline = new Date(regDeadlineRaw);
      if (Number.isNaN(regDeadline.getTime())) {
        return ack({ success: false, message: "Invalid registration deadline." });
      }
    }
    let entryFee = null;
    if (entryFeeRaw !== undefined && entryFeeRaw !== null && entryFeeRaw !== "") {
      const n = Number(entryFeeRaw);
      if (!Number.isFinite(n) || n < 0) {
        return ack({ success: false, message: "Invalid entry fee." });
      }
      entryFee = Math.round(n * 100) / 100;
    }

    // BACKEND-ENFORCED (deliberately not a DB CHECK constraint — see
    // Database/schema/007_content_community.sql header): team_size is required
    // for team tournaments, and not meaningful for individual ones.
    let teamSize = null;
    if (registrationType === "team") {
      teamSize = toInt(teamSizeRaw, 0);
      if (!teamSize || teamSize < 1) {
        return ack({ success: false, message: "teamSize is required for team tournaments." });
      }
    } else if (teamSizeRaw !== undefined && teamSizeRaw !== null && teamSizeRaw !== "") {
      return ack({ success: false, message: "teamSize is only applicable to team tournaments." });
    }

    let maxEntries = null;
    if (maxEntriesRaw !== undefined && maxEntriesRaw !== null && maxEntriesRaw !== "") {
      const n = toInt(maxEntriesRaw, -1);
      if (n < 0) return ack({ success: false, message: "Invalid max entries." });
      maxEntries = n;
    }

    const slugBase = slugify(payload.slug || name) || `tournament-${Date.now()}`;

    try {
      let tournamentId;
      let slug = slugBase;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const [result] = await db.execute(
            `INSERT INTO TOURNAMENTS
              (esports_game_id, name, slug, description, start_date, end_date, location,
               entry_fee, organizer, rules, registration_deadline, registration_type,
               team_size, max_entries, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
            [
              esportsGameId, name, slug, description || null, startDate, endDate,
              location || null, entryFee, organizer || null, rules || null, regDeadline,
              registrationType, teamSize, maxEntries,
            ]
          );
          tournamentId = result.insertId;
          break;
        } catch (err) {
          if (err?.code === "ER_DUP_ENTRY" && attempt < 2) {
            slug = `${slugBase}-${Date.now().toString(36)}`;
            continue;
          }
          throw err;
        }
      }

      const [rows] = await db.execute(`${SELECT_TOURNAMENT_SQL} WHERE t.id = ? LIMIT 1`, [tournamentId]);
      const created = safeTournamentRow(rows?.[0]);
      created.participants = [];
      created.teams = [];
      io?.emit?.("tournament:created", created);

      // 📧 Broadcast to all users (non-blocking) — unchanged from pre-migration behavior
      (async () => {
        try {
          const [userRows] = await db.execute(
            "SELECT email FROM USERS WHERE email IS NOT NULL AND email <> ''",
          );
          const recipients = userRows.map((r) => r.email);
          if (!recipients.length) return;

          const escapeHtml = (s) =>
            String(s ?? "")
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");

          const fmtDt = (val) => {
            if (!val) return "";
            const d = new Date(val);
            if (Number.isNaN(d.getTime())) return "";
            return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
          };

          const safeName = String(created.name || "New Tournament");
          const subject = `🏆 New Tournament: ${safeName}`;
          const startStr = fmtDt(created.start_date);
          const endStr = fmtDt(created.end_date);
          const fee = created.entry_fee != null ? `BND ${Number(created.entry_fee).toFixed(2)}` : "Free";

          const rowHtml = (label, value) =>
            value
              ? `<tr><td style="padding:4px 8px;color:#fbbf24;font-weight:bold;">${label}</td><td style="padding:4px 8px;color:#fef3c7;">${escapeHtml(value)}</td></tr>`
              : "";

          const html = `
            <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;background:#0f172a;color:#fde68a;border-radius:12px;">
              <p style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#f59e0b;margin:0 0 8px;">
                Gamer Tavern · Tournament
              </p>
              <h1 style="font-size:24px;margin:0 0 16px;color:#fef3c7;">${escapeHtml(safeName)}</h1>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                ${rowHtml("Game", created.esports_game_name)}
                ${rowHtml("Starts", startStr)}
                ${rowHtml("Ends", endStr)}
                ${rowHtml("Location", created.location)}
                ${rowHtml("Entry Fee", fee)}
                ${rowHtml("Organizer", created.organizer)}
              </table>
              ${created.description ? `<p style="font-size:14px;line-height:1.6;color:#fef3c7;margin:16px 0 0;">${escapeHtml(created.description)}</p>` : ""}
              <hr style="border:none;border-top:1px solid #78350f;margin:24px 0;" />
              <p style="font-size:12px;color:#fbbf24;margin:0;">
                Sign in to the Tavern to register and claim your seat.
              </p>
            </div>
          `;

          const text =
            `${safeName}\n` +
            `Game: ${created.esports_game_name || ""}\n` +
            `Starts: ${startStr}\n` +
            (endStr ? `Ends: ${endStr}\n` : "") +
            (created.location ? `Location: ${created.location}\n` : "") +
            `Entry Fee: ${fee}\n` +
            (created.description ? `\n${created.description}\n` : "");

          const result = await sendBulkEmail({ recipients, subject, html, text });
          console.log(`[tournament:create] 📧 broadcast email — sent: ${result.sent}/${result.total ?? 0}`);
        } catch (mailErr) {
          console.error("[tournament:create] email broadcast failed:", mailErr);
        }
      })();

      return ack({ success: true, data: created });
    } catch (err) {
      if (err?.code === "ER_NO_REFERENCED_ROW_2" || err?.code === "ER_NO_REFERENCED_ROW") {
        return ack({ success: false, message: "Unknown esportsGameId." });
      }
      console.error("[tournament:create] error", err);
      return ack({ success: false, message: "Failed to create tournament." });
    }
  });

  /* =========================================================
     UPDATE TOURNAMENT  (ADMIN ONLY)
     ========================================================= */
  socket.on("tournament:update", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const auth = requireAdmin(socket);
    if (!auth.ok) return ack({ success: false, code: auth.code, message: auth.message });

    const id = toInt(payload.id, 0);
    if (!id) return ack({ success: false, message: "Tournament id is required." });

    const [curRows] = await db.execute(`SELECT status FROM TOURNAMENTS WHERE id = ? LIMIT 1`, [id]);
    const current = curRows?.[0];
    if (!current) return ack({ success: false, message: "Tournament not found." });

    const sets = [];
    const params = [];

    if (payload.name !== undefined) {
      const v = toStr(payload.name);
      if (!v) return ack({ success: false, message: "Name cannot be empty." });
      sets.push("name = ?");
      params.push(v);
    }
    if (payload.description !== undefined) {
      sets.push("description = ?");
      params.push(toStr(payload.description) || null);
    }
    if (payload.location !== undefined) {
      sets.push("location = ?");
      params.push(toStr(payload.location) || null);
    }
    if (payload.esportsGameId !== undefined || payload.esports_game_id !== undefined) {
      const v = toInt(payload.esportsGameId ?? payload.esports_game_id, 0);
      if (!v) return ack({ success: false, message: "esportsGameId cannot be empty." });
      sets.push("esports_game_id = ?");
      params.push(v);
    }
    if (payload.organizer !== undefined) {
      sets.push("organizer = ?");
      params.push(toStr(payload.organizer) || null);
    }
    if (payload.rules !== undefined) {
      sets.push("rules = ?");
      params.push(toStr(payload.rules) || null);
    }

    const parseDateField = (raw, label) => {
      if (raw === null || raw === "") return { ok: true, value: null };
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return { ok: false, message: `Invalid ${label}.` };
      return { ok: true, value: d };
    };

    if (payload.startDate !== undefined || payload.start_date !== undefined) {
      const r = parseDateField(payload.startDate ?? payload.start_date, "start date");
      if (!r.ok) return ack({ success: false, message: r.message });
      if (r.value === null) return ack({ success: false, message: "Start date is required." });
      sets.push("start_date = ?");
      params.push(r.value);
    }
    if (payload.endDate !== undefined || payload.end_date !== undefined) {
      const r = parseDateField(payload.endDate ?? payload.end_date, "end date");
      if (!r.ok) return ack({ success: false, message: r.message });
      sets.push("end_date = ?");
      params.push(r.value);
    }
    if (payload.registrationDeadline !== undefined || payload.registration_deadline !== undefined) {
      const r = parseDateField(
        payload.registrationDeadline ?? payload.registration_deadline,
        "registration deadline"
      );
      if (!r.ok) return ack({ success: false, message: r.message });
      sets.push("registration_deadline = ?");
      params.push(r.value);
    }
    if (payload.entryFee !== undefined || payload.entry_fee !== undefined) {
      const raw = payload.entryFee ?? payload.entry_fee;
      let val = null;
      if (raw !== null && raw !== "") {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) return ack({ success: false, message: "Invalid entry fee." });
        val = Math.round(n * 100) / 100;
      }
      sets.push("entry_fee = ?");
      params.push(val);
    }
    if (payload.maxEntries !== undefined || payload.max_entries !== undefined || payload.max_teams !== undefined) {
      const raw = payload.maxEntries ?? payload.max_entries ?? payload.max_teams;
      let val = null;
      if (raw !== null && raw !== "") {
        const n = toInt(raw, -1);
        if (n < 0) return ack({ success: false, message: "Invalid max entries." });
        val = n;
      }
      sets.push("max_entries = ?");
      params.push(val);
    }
    if (payload.status !== undefined) {
      const nextStatus = toStr(payload.status);
      const allowed = VALID_STATUS_TRANSITIONS[current.status] || [];
      if (nextStatus !== current.status && !allowed.includes(nextStatus)) {
        return ack({
          success: false,
          message: `Cannot change status from '${current.status}' to '${nextStatus}'.`,
        });
      }
      sets.push("status = ?");
      params.push(nextStatus);
    }

    if (sets.length === 0) {
      return ack({ success: false, message: "Nothing to update." });
    }

    sets.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    try {
      const [result] = await db.execute(`UPDATE TOURNAMENTS SET ${sets.join(", ")} WHERE id = ?`, params);
      if (result.affectedRows === 0) {
        return ack({ success: false, message: "Tournament not found." });
      }

      const [rows] = await db.execute(`${SELECT_TOURNAMENT_SQL} WHERE t.id = ? LIMIT 1`, [id]);
      const updated = safeTournamentRow(rows?.[0]);
      const registrationsMap = await fetchRegistrationsByTournamentIds(db, [id]);
      const teamsMap = await fetchTeamsByTournamentIds(db, [id]);
      updated.participants = registrationsMap.get(id) || [];
      updated.teams = updated.registration_type === "team" ? teamsMap.get(id) || [] : [];

      io?.emit?.("tournament:updated", updated);
      return ack({ success: true, data: updated });
    } catch (err) {
      if (err?.code === "ER_NO_REFERENCED_ROW_2" || err?.code === "ER_NO_REFERENCED_ROW") {
        return ack({ success: false, message: "Unknown esportsGameId." });
      }
      console.error("[tournament:update] error", err);
      return ack({ success: false, message: "Failed to update tournament." });
    }
  });

  /* =========================================================
     DELETE TOURNAMENT  (ADMIN ONLY)
     ========================================================= */
  socket.on("tournament:delete", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const auth = requireAdmin(socket);
    if (!auth.ok) return ack({ success: false, code: auth.code, message: auth.message });

    const id = toInt(payload.id, 0);
    if (!id) return ack({ success: false, message: "Tournament id is required." });

    try {
      const [result] = await db.execute("DELETE FROM TOURNAMENTS WHERE id = ?", [id]);
      if (result.affectedRows === 0) {
        return ack({ success: false, message: "Tournament not found." });
      }
      io?.emit?.("tournament:deleted", { id });
      return ack({ success: true, data: { id } });
    } catch (err) {
      console.error("[tournament:delete] error", err);
      return ack({ success: false, message: "Failed to delete tournament." });
    }
  });

  /* =========================================================
     JOIN TOURNAMENT
       - individual mode: one registration row (authenticated or guest)
       - team mode: one team + one registration per member, all transactional
     ========================================================= */
  socket.on("tournament:join", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const tournamentId = toInt(payload.tournamentId ?? payload.id, 0);
    if (!tournamentId) return ack({ success: false, message: "Tournament id is required." });

    // Identity from the verified handshake, never the payload — an authenticated
    // caller always registers as themselves and can never impersonate another user.
    const isAuthenticated = Boolean(socket.user);
    const selfUserId = isAuthenticated ? toInt(socket.user.id, 0) : 0;
    const selfGuestName = isAuthenticated ? "" : toStr(payload.guestName ?? payload.guest_name);
    const selfNickname = toStr(payload.nickname);

    try {
      const [tRows] = await db.execute(
        `SELECT id, registration_type, team_size, max_entries, status
         FROM TOURNAMENTS WHERE id = ? LIMIT 1`,
        [tournamentId]
      );
      const tournament = tRows?.[0];
      if (!tournament) return ack({ success: false, message: "Tournament not found." });
      if (tournament.status !== OPEN_STATUS) {
        return ack({ success: false, message: "This tournament is not open for registration." });
      }

      if (isAuthenticated) {
        const [userRows] = await db.execute("SELECT id FROM USERS WHERE id = ? LIMIT 1", [selfUserId]);
        if (!userRows?.[0]) return ack({ success: false, message: "Account not found." });
      } else if (!selfGuestName) {
        return ack({ success: false, message: "Please enter a display name to join as a guest." });
      } else if (selfGuestName.length > 100) {
        return ack({ success: false, message: "Guest name is too long." });
      }

      if (tournament.registration_type === "team") {
        return await joinAsTeam({ db, io, tournament, tournamentId, isAuthenticated, selfUserId, selfGuestName, selfNickname, payload, ack });
      }
      return await joinAsIndividual({ db, io, tournament, tournamentId, isAuthenticated, selfUserId, selfGuestName, selfNickname, ack });
    } catch (err) {
      console.error("[tournament:join] error", err);
      return ack({ success: false, message: "Failed to join tournament." });
    }
  });

  async function joinAsIndividual({ db, io, tournament, tournamentId, isAuthenticated, selfUserId, selfGuestName, selfNickname, ack }) {
    // Capacity: excludes withdrawn registrations.
    if (tournament.max_entries != null && tournament.max_entries > 0) {
      const [cnt] = await db.execute(
        "SELECT COUNT(*) AS c FROM TOURNAMENT_REGISTRATIONS WHERE tournament_id = ? AND status <> 'withdrawn'",
        [tournamentId]
      );
      if ((cnt?.[0]?.c ?? 0) >= tournament.max_entries) {
        return ack({ success: false, message: "Tournament is full." });
      }
    }

    if (isAuthenticated) {
      const [existing] = await db.execute(
        "SELECT id FROM TOURNAMENT_REGISTRATIONS WHERE tournament_id = ? AND user_id = ? LIMIT 1",
        [tournamentId, selfUserId]
      );
      if (existing?.[0]) {
        return ack({ success: false, message: "You already joined this tournament." });
      }
    }

    await db.execute(
      `INSERT INTO TOURNAMENT_REGISTRATIONS (tournament_id, user_id, guest_name, nickname)
       VALUES (?, ?, ?, ?)`,
      [tournamentId, isAuthenticated ? selfUserId : null, isAuthenticated ? null : selfGuestName, selfNickname || null]
    );

    const registrationsMap = await fetchRegistrationsByTournamentIds(db, [tournamentId]);
    const participants = registrationsMap.get(tournamentId) || [];
    io?.emit?.("tournament:participants_updated", { tournament_id: tournamentId, participants });
    return ack({ success: true, data: { tournament_id: tournamentId, participants } });
  }

  async function joinAsTeam({ db, io, tournament, tournamentId, isAuthenticated, selfUserId, selfGuestName, selfNickname, payload, ack }) {
    const teamName = toStr(payload.teamName ?? payload.team_name);
    if (!teamName) return ack({ success: false, message: "A team name is required." });

    const teammatesRaw = Array.isArray(payload.teammates) ? payload.teammates : [];
    // Additional members can only be guests — there is no invite/accept flow yet, so a
    // teammate can never be tied to another real user's account within this request
    // (that would let the submitter claim someone else's identity without their consent).
    const teammates = teammatesRaw.map((m) => ({
      guestName: toStr(m?.guestName ?? m?.guest_name),
      nickname: toStr(m?.nickname),
    }));

    if (teammates.some((m) => !m.guestName)) {
      return ack({ success: false, message: "Every teammate needs a display name." });
    }

    const totalMembers = 1 + teammates.length;
    if (tournament.team_size && totalMembers !== tournament.team_size) {
      return ack({
        success: false,
        message: `This tournament requires teams of exactly ${tournament.team_size} (got ${totalMembers}).`,
      });
    }

    // Capacity: counts TEAMS, not players, excluding withdrawn teams.
    if (tournament.max_entries != null && tournament.max_entries > 0) {
      const [cnt] = await db.execute(
        "SELECT COUNT(*) AS c FROM TOURNAMENT_TEAMS WHERE tournament_id = ? AND status <> 'withdrawn'",
        [tournamentId]
      );
      if ((cnt?.[0]?.c ?? 0) >= tournament.max_entries) {
        return ack({ success: false, message: "This tournament is full." });
      }
    }

    if (isAuthenticated) {
      const [existing] = await db.execute(
        "SELECT id FROM TOURNAMENT_REGISTRATIONS WHERE tournament_id = ? AND user_id = ? LIMIT 1",
        [tournamentId, selfUserId]
      );
      if (existing?.[0]) {
        return ack({ success: false, message: "You already joined this tournament." });
      }
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [teamResult] = await conn.execute(
        `INSERT INTO TOURNAMENT_TEAMS (tournament_id, name) VALUES (?, ?)`,
        [tournamentId, teamName]
      );
      const teamId = teamResult.insertId;

      const members = [
        { userId: isAuthenticated ? selfUserId : null, guestName: isAuthenticated ? null : selfGuestName, nickname: selfNickname || null },
        ...teammates.map((m) => ({ userId: null, guestName: m.guestName, nickname: m.nickname || null })),
      ];

      let captainRegistrationId = null;
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        const [regResult] = await conn.execute(
          `INSERT INTO TOURNAMENT_REGISTRATIONS (tournament_id, user_id, guest_name, nickname)
           VALUES (?, ?, ?, ?)`,
          [tournamentId, m.userId, m.guestName, m.nickname]
        );
        const registrationId = regResult.insertId;
        await conn.execute(
          `INSERT INTO TOURNAMENT_TEAM_MEMBERS (tournament_id, team_id, registration_id)
           VALUES (?, ?, ?)`,
          [tournamentId, teamId, registrationId]
        );
        if (i === 0) captainRegistrationId = registrationId; // the submitter is always captain
      }

      // Safe by construction: captainRegistrationId was just created in this same
      // transaction as a member of this exact team, so both required invariants
      // (same tournament, actual team member) hold without extra validation.
      await conn.execute(`UPDATE TOURNAMENT_TEAMS SET captain_registration_id = ? WHERE id = ?`, [
        captainRegistrationId,
        teamId,
      ]);

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      if (err?.code === "ER_DUP_ENTRY") {
        return ack({ success: false, message: "A team with that name already exists in this tournament." });
      }
      throw err;
    } finally {
      conn.release();
    }

    const teamsMap = await fetchTeamsByTournamentIds(db, [tournamentId]);
    const teams = teamsMap.get(tournamentId) || [];
    io?.emit?.("tournament:teams_updated", { tournament_id: tournamentId, teams });
    return ack({ success: true, data: { tournament_id: tournamentId, teams } });
  }

  /* =========================================================
     LEAVE TOURNAMENT
       - own registration (individual or team member): delete by user_id — cascades
         to tournament_team_members automatically if they were on a team
       - specific participant (self or admin): delete by participantId
       - whole team (captain or admin): delete every member's registration, then the team
     ========================================================= */
  socket.on("tournament:leave", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const userId = socket.user ? toInt(socket.user.id, 0) : 0;
    const participantId = toInt(payload.participantId ?? payload.participant_id, 0);
    const teamId = toInt(payload.teamId ?? payload.team_id, 0);
    const tournamentId = toInt(payload.tournamentId ?? payload.id, 0);
    if (!tournamentId) return ack({ success: false, message: "Tournament id is required." });

    try {
      const isAdmin = String(socket.user?.role || "").toUpperCase() === "ADMIN";

      if (teamId) {
        const [teamRows] = await db.execute(
          `SELECT t.id, t.captain_registration_id, r.user_id AS captain_user_id
           FROM TOURNAMENT_TEAMS t
           LEFT JOIN TOURNAMENT_REGISTRATIONS r ON r.id = t.captain_registration_id
           WHERE t.id = ? AND t.tournament_id = ? LIMIT 1`,
          [teamId, tournamentId]
        );
        const team = teamRows?.[0];
        if (!team) return ack({ success: false, message: "Team not found." });

        const isCaptain = userId && team.captain_user_id && Number(team.captain_user_id) === userId;
        if (!isCaptain && !isAdmin) {
          return ack({ success: false, message: "Not allowed." });
        }

        const conn = await db.getConnection();
        try {
          await conn.beginTransaction();
          await conn.execute(
            `DELETE FROM TOURNAMENT_REGISTRATIONS
             WHERE id IN (SELECT registration_id FROM TOURNAMENT_TEAM_MEMBERS WHERE team_id = ?)`,
            [teamId]
          );
          await conn.execute(`DELETE FROM TOURNAMENT_TEAMS WHERE id = ?`, [teamId]);
          await conn.commit();
        } catch (err) {
          await conn.rollback();
          throw err;
        } finally {
          conn.release();
        }
      } else if (participantId) {
        const [rows] = await db.execute(
          "SELECT id, user_id FROM TOURNAMENT_REGISTRATIONS WHERE id = ? AND tournament_id = ? LIMIT 1",
          [participantId, tournamentId]
        );
        const row = rows?.[0];
        if (!row) return ack({ success: false, message: "Participant not found." });

        const isOwner = userId && row.user_id && Number(row.user_id) === userId;
        if (!isOwner && !isAdmin) {
          return ack({ success: false, message: "Not allowed." });
        }
        const [result] = await db.execute("DELETE FROM TOURNAMENT_REGISTRATIONS WHERE id = ?", [participantId]);
        if (result.affectedRows === 0) {
          return ack({ success: false, message: "You haven't joined this tournament." });
        }
      } else {
        if (!userId) return ack({ success: false, message: "Authentication required." });
        const [result] = await db.execute(
          "DELETE FROM TOURNAMENT_REGISTRATIONS WHERE tournament_id = ? AND user_id = ?",
          [tournamentId, userId]
        );
        if (result.affectedRows === 0) {
          return ack({ success: false, message: "You haven't joined this tournament." });
        }
      }

      const registrationsMap = await fetchRegistrationsByTournamentIds(db, [tournamentId]);
      const teamsMap = await fetchTeamsByTournamentIds(db, [tournamentId]);
      const participants = registrationsMap.get(tournamentId) || [];
      const teams = teamsMap.get(tournamentId) || [];

      io?.emit?.("tournament:participants_updated", { tournament_id: tournamentId, participants });
      io?.emit?.("tournament:teams_updated", { tournament_id: tournamentId, teams });
      return ack({ success: true, data: { tournament_id: tournamentId, participants, teams } });
    } catch (err) {
      console.error("[tournament:leave] error", err);
      return ack({ success: false, message: "Failed to leave tournament." });
    }
  });
}
