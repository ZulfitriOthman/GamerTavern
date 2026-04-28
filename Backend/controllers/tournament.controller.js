// Backend/controllers/tournament.controller.js

const toStr = (v) => (v == null ? "" : String(v)).trim();
const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/**
 * Verify caller is ADMIN by looking up PERSONAL_USER.ROLE.
 * Returns { ok: true, user } or { ok: false, message }.
 */
async function requireAdmin(db, userId) {
  const id = toInt(userId, 0);
  if (!id) return { ok: false, message: "Authentication required." };
  try {
    const [rows] = await db.execute(
      "SELECT ID, ROLE, NAME FROM PERSONAL_USER WHERE ID = ? LIMIT 1",
      [id],
    );
    const row = rows?.[0];
    if (!row) return { ok: false, message: "Account not found." };
    if (String(row.ROLE || "").toUpperCase() !== "ADMIN") {
      return { ok: false, message: "Admin privileges required." };
    }
    return { ok: true, user: row };
  } catch (err) {
    console.error("[tournament] requireAdmin error", err);
    return { ok: false, message: "Authorization check failed." };
  }
}

function safeTournamentRow(row) {
  if (!row) return null;
  return {
    id: row.ID,
    name: row.NAME,
    description: row.DESCRIPTION,
    start_date: row.START_DATE,
    end_date: row.END_DATE,
    location: row.LOCATION,
    entry_fee: row.ENTRY_FEE,
    game_title: row.GAME_TITLE,
    organizer: row.ORGANIZER,
    rules: row.RULES,
    registration_deadline: row.REGISTRATION_DEADLINE,
    max_teams: row.MAX_TEAMS,
    created_at: row.CREATED_AT,
    updated_at: row.UPDATED_AT,
  };
}

const SELECT_TOURNAMENT_COLS = `
  ID, NAME, DESCRIPTION, START_DATE, END_DATE, LOCATION, ENTRY_FEE,
  GAME_TITLE, ORGANIZER, RULES, REGISTRATION_DEADLINE, MAX_TEAMS,
  CREATED_AT, UPDATED_AT
`;

function safeParticipantRow(row) {
  if (!row) return null;
  return {
    id: row.ID,
    tournament_id: row.TOURNAMENT_ID,
    user_id: row.USER_ID,
    guest_name: row.GUEST_NAME,
    nickname: row.NICKNAME,
    team_name: row.TEAM_NAME,
    registration_date: row.REGISTRATION_DATE,
    user_name: row.USER_NAME,
    user_role: row.USER_ID ? row.USER_ROLE : "GUEST",
  };
}

async function fetchParticipantsByTournamentIds(db, ids) {
  if (!ids || ids.length === 0) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await db.execute(
    `SELECT P.ID, P.TOURNAMENT_ID, P.USER_ID, P.GUEST_NAME, P.NICKNAME, P.TEAM_NAME,
            P.REGISTRATION_DATE, U.NAME AS USER_NAME, U.ROLE AS USER_ROLE
     FROM PARTICIPANTS P
     LEFT JOIN PERSONAL_USER U ON U.ID = P.USER_ID
     WHERE P.TOURNAMENT_ID IN (${placeholders})
     ORDER BY P.REGISTRATION_DATE ASC, P.ID ASC`,
    ids,
  );
  const map = new Map();
  for (const r of rows || []) {
    const safe = safeParticipantRow(r);
    if (!map.has(safe.tournament_id)) map.set(safe.tournament_id, []);
    map.get(safe.tournament_id).push(safe);
  }
  return map;
}

export default function tournamentSocketController({ socket, io, db }) {
  /* =========================================================
     LIST TOURNAMENTS  (PUBLIC)
     ========================================================= */
  socket.on("tournament:list", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const game = toStr(payload.game);
    const monthKey = toStr(payload.month); // YYYY-MM

    try {
      const where = [];
      const params = [];

      if (game && game !== "All") {
        where.push("GAME_TITLE = ?");
        params.push(game);
      }

      if (monthKey) {
        where.push("DATE_FORMAT(START_DATE, '%Y-%m') = ?");
        params.push(monthKey);
      }

      const sql = `
        SELECT ${SELECT_TOURNAMENT_COLS}
        FROM TOURNAMENT
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY START_DATE ASC
      `;

      const [rows] = await db.execute(sql, params);
      const tournaments = (rows || []).map(safeTournamentRow);
      const ids = tournaments.map((t) => t.id);
      const partsMap = await fetchParticipantsByTournamentIds(db, ids);
      for (const t of tournaments) {
        t.participants = partsMap.get(t.id) || [];
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

    const auth = await requireAdmin(db, payload.userId);
    if (!auth.ok) return ack({ success: false, message: auth.message });

    const name = toStr(payload.name);
    const description = toStr(payload.description);
    const gameTitle = toStr(payload.gameTitle ?? payload.game_title);
    const location = toStr(payload.location);
    const rules = toStr(payload.rules);
    const organizer = toStr(payload.organizer) || auth.user.NAME || "Admin";
    const startRaw = toStr(payload.startDate ?? payload.start_date);
    const endRaw = toStr(payload.endDate ?? payload.end_date);
    const entryFeeRaw = payload.entryFee ?? payload.entry_fee;
    const maxTeamsRaw = payload.maxTeams ?? payload.max_teams;
    const regDeadlineRaw = toStr(
      payload.registrationDeadline ?? payload.registration_deadline,
    );

    if (!name) return ack({ success: false, message: "Name is required." });
    if (!startRaw) return ack({ success: false, message: "Start date is required." });

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
      entryFee = n;
    }
    let maxTeams = null;
    if (maxTeamsRaw !== undefined && maxTeamsRaw !== null && maxTeamsRaw !== "") {
      const n = toInt(maxTeamsRaw, -1);
      if (n < 0) return ack({ success: false, message: "Invalid max teams." });
      maxTeams = n;
    }

    try {
      const sql = `
        INSERT INTO TOURNAMENT
          (NAME, DESCRIPTION, START_DATE, END_DATE, LOCATION, ENTRY_FEE,
           GAME_TITLE, ORGANIZER, RULES, REGISTRATION_DEADLINE, MAX_TEAMS)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [result] = await db.execute(sql, [
        name,
        description || null,
        startDate,
        endDate,
        location || null,
        entryFee,
        gameTitle || null,
        organizer || null,
        rules || null,
        regDeadline,
        maxTeams,
      ]);

      const [rows] = await db.execute(
        `SELECT ${SELECT_TOURNAMENT_COLS} FROM TOURNAMENT WHERE ID = ? LIMIT 1`,
        [result.insertId],
      );

      const created = safeTournamentRow(rows?.[0]);
      io?.emit?.("tournament:created", created);
      return ack({ success: true, data: created });
    } catch (err) {
      console.error("[tournament:create] error", err);
      return ack({ success: false, message: "Failed to create tournament." });
    }
  });

  /* =========================================================
     UPDATE TOURNAMENT  (ADMIN ONLY)
     ========================================================= */
  socket.on("tournament:update", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const auth = await requireAdmin(db, payload.userId);
    if (!auth.ok) return ack({ success: false, message: auth.message });

    const id = toInt(payload.id, 0);
    if (!id) return ack({ success: false, message: "Tournament id is required." });

    const sets = [];
    const params = [];

    const setStr = (col, val, allowEmpty = true) => {
      const v = toStr(val);
      sets.push(`${col} = ?`);
      params.push(v || (allowEmpty ? null : v));
    };

    if (payload.name !== undefined) {
      const v = toStr(payload.name);
      if (!v) return ack({ success: false, message: "Name cannot be empty." });
      sets.push("NAME = ?");
      params.push(v);
    }
    if (payload.description !== undefined) setStr("DESCRIPTION", payload.description);
    if (payload.location !== undefined) setStr("LOCATION", payload.location);
    if (payload.gameTitle !== undefined || payload.game_title !== undefined)
      setStr("GAME_TITLE", payload.gameTitle ?? payload.game_title);
    if (payload.organizer !== undefined) setStr("ORGANIZER", payload.organizer);
    if (payload.rules !== undefined) setStr("RULES", payload.rules);

    const parseDateField = (raw, label) => {
      if (raw === null || raw === "") return { ok: true, value: null };
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, message: `Invalid ${label}.` };
      }
      return { ok: true, value: d };
    };

    if (payload.startDate !== undefined || payload.start_date !== undefined) {
      const r = parseDateField(payload.startDate ?? payload.start_date, "start date");
      if (!r.ok) return ack({ success: false, message: r.message });
      if (r.value === null)
        return ack({ success: false, message: "Start date is required." });
      sets.push("START_DATE = ?");
      params.push(r.value);
    }
    if (payload.endDate !== undefined || payload.end_date !== undefined) {
      const r = parseDateField(payload.endDate ?? payload.end_date, "end date");
      if (!r.ok) return ack({ success: false, message: r.message });
      sets.push("END_DATE = ?");
      params.push(r.value);
    }
    if (
      payload.registrationDeadline !== undefined ||
      payload.registration_deadline !== undefined
    ) {
      const r = parseDateField(
        payload.registrationDeadline ?? payload.registration_deadline,
        "registration deadline",
      );
      if (!r.ok) return ack({ success: false, message: r.message });
      sets.push("REGISTRATION_DEADLINE = ?");
      params.push(r.value);
    }
    if (payload.entryFee !== undefined || payload.entry_fee !== undefined) {
      const raw = payload.entryFee ?? payload.entry_fee;
      let val = null;
      if (raw !== null && raw !== "") {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0)
          return ack({ success: false, message: "Invalid entry fee." });
        val = n;
      }
      sets.push("ENTRY_FEE = ?");
      params.push(val);
    }
    if (payload.maxTeams !== undefined || payload.max_teams !== undefined) {
      const raw = payload.maxTeams ?? payload.max_teams;
      let val = null;
      if (raw !== null && raw !== "") {
        const n = toInt(raw, -1);
        if (n < 0) return ack({ success: false, message: "Invalid max teams." });
        val = n;
      }
      sets.push("MAX_TEAMS = ?");
      params.push(val);
    }

    if (sets.length === 0) {
      return ack({ success: false, message: "Nothing to update." });
    }

    sets.push("UPDATED_AT = CURRENT_TIMESTAMP");
    params.push(id);

    try {
      const [result] = await db.execute(
        `UPDATE TOURNAMENT SET ${sets.join(", ")} WHERE ID = ?`,
        params,
      );
      if (result.affectedRows === 0) {
        return ack({ success: false, message: "Tournament not found." });
      }

      const [rows] = await db.execute(
        `SELECT ${SELECT_TOURNAMENT_COLS} FROM TOURNAMENT WHERE ID = ? LIMIT 1`,
        [id],
      );

      const updated = safeTournamentRow(rows?.[0]);
      io?.emit?.("tournament:updated", updated);
      return ack({ success: true, data: updated });
    } catch (err) {
      console.error("[tournament:update] error", err);
      return ack({ success: false, message: "Failed to update tournament." });
    }
  });

  /* =========================================================
     DELETE TOURNAMENT  (ADMIN ONLY)
     ========================================================= */
  socket.on("tournament:delete", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const auth = await requireAdmin(db, payload.userId);
    if (!auth.ok) return ack({ success: false, message: auth.message });

    const id = toInt(payload.id, 0);
    if (!id) return ack({ success: false, message: "Tournament id is required." });

    try {
      const [result] = await db.execute("DELETE FROM TOURNAMENT WHERE ID = ?", [id]);
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
     JOIN TOURNAMENT  (logged-in user OR guest with a name)
     ========================================================= */
  socket.on("tournament:join", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const userId = toInt(payload.userId, 0);
    const guestName = toStr(payload.guestName ?? payload.guest_name);

    const tournamentId = toInt(payload.tournamentId ?? payload.id, 0);
    if (!tournamentId)
      return ack({ success: false, message: "Tournament id is required." });

    if (!userId && !guestName) {
      return ack({
        success: false,
        message: "Please enter a display name to join as a guest.",
      });
    }
    if (!userId && guestName.length > 100) {
      return ack({ success: false, message: "Guest name is too long." });
    }

    const nickname = toStr(payload.nickname);
    const teamName = toStr(payload.teamName ?? payload.team_name);

    try {
      if (userId) {
        const [userRows] = await db.execute(
          "SELECT ID, NAME, ROLE FROM PERSONAL_USER WHERE ID = ? LIMIT 1",
          [userId],
        );
        if (!userRows?.[0]) return ack({ success: false, message: "Account not found." });
      }

      // Verify tournament exists
      const [trows] = await db.execute(
        "SELECT ID, MAX_TEAMS FROM TOURNAMENT WHERE ID = ? LIMIT 1",
        [tournamentId],
      );
      if (!trows?.[0]) return ack({ success: false, message: "Tournament not found." });

      // Check capacity
      const maxTeams = trows[0].MAX_TEAMS;
      if (maxTeams != null && maxTeams > 0) {
        const [cnt] = await db.execute(
          "SELECT COUNT(*) AS C FROM PARTICIPANTS WHERE TOURNAMENT_ID = ?",
          [tournamentId],
        );
        if ((cnt?.[0]?.C ?? 0) >= maxTeams) {
          return ack({ success: false, message: "Tournament is full." });
        }
      }

      // Check duplicate (only meaningful for logged-in users)
      if (userId) {
        const [existing] = await db.execute(
          "SELECT ID FROM PARTICIPANTS WHERE TOURNAMENT_ID = ? AND USER_ID = ? LIMIT 1",
          [tournamentId, userId],
        );
        if (existing?.[0]) {
          return ack({ success: false, message: "You already joined this tournament." });
        }
      }

      await db.execute(
        `INSERT INTO PARTICIPANTS (TOURNAMENT_ID, USER_ID, GUEST_NAME, NICKNAME, TEAM_NAME)
         VALUES (?, ?, ?, ?, ?)`,
        [
          tournamentId,
          userId || null,
          userId ? null : guestName,
          nickname || null,
          teamName || null,
        ],
      );

      const partsMap = await fetchParticipantsByTournamentIds(db, [tournamentId]);
      const participants = partsMap.get(tournamentId) || [];
      io?.emit?.("tournament:participants_updated", {
        tournament_id: tournamentId,
        participants,
      });
      return ack({ success: true, data: { tournament_id: tournamentId, participants } });
    } catch (err) {
      console.error("[tournament:join] error", err);
      return ack({ success: false, message: "Failed to join tournament." });
    }
  });

  /* =========================================================
     LEAVE TOURNAMENT
       - logged-in users: delete by (tournament, user)
       - guests / admins removing entries: delete by participant id + admin flag
     ========================================================= */
  socket.on("tournament:leave", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const userId = toInt(payload.userId, 0);
    const participantId = toInt(payload.participantId ?? payload.participant_id, 0);
    const tournamentId = toInt(payload.tournamentId ?? payload.id, 0);
    if (!tournamentId)
      return ack({ success: false, message: "Tournament id is required." });

    try {
      let result;
      if (participantId) {
        // Removing a specific participant entry (admin removing a guest, or self by id).
        // Allow if: it's the user's own entry, OR the caller is an admin.
        const [rows] = await db.execute(
          "SELECT ID, USER_ID FROM PARTICIPANTS WHERE ID = ? AND TOURNAMENT_ID = ? LIMIT 1",
          [participantId, tournamentId],
        );
        const row = rows?.[0];
        if (!row) {
          return ack({ success: false, message: "Participant not found." });
        }
        const isOwner = userId && row.USER_ID && Number(row.USER_ID) === userId;
        let isAdmin = false;
        if (userId && !isOwner) {
          const [u] = await db.execute(
            "SELECT ROLE FROM PERSONAL_USER WHERE ID = ? LIMIT 1",
            [userId],
          );
          isAdmin = String(u?.[0]?.ROLE || "").toUpperCase() === "ADMIN";
        }
        if (!isOwner && !isAdmin) {
          return ack({ success: false, message: "Not allowed." });
        }
        [result] = await db.execute(
          "DELETE FROM PARTICIPANTS WHERE ID = ?",
          [participantId],
        );
      } else {
        if (!userId)
          return ack({ success: false, message: "Authentication required." });
        [result] = await db.execute(
          "DELETE FROM PARTICIPANTS WHERE TOURNAMENT_ID = ? AND USER_ID = ?",
          [tournamentId, userId],
        );
      }
      if (result.affectedRows === 0) {
        return ack({ success: false, message: "You haven't joined this tournament." });
      }

      const partsMap = await fetchParticipantsByTournamentIds(db, [tournamentId]);
      const participants = partsMap.get(tournamentId) || [];
      io?.emit?.("tournament:participants_updated", {
        tournament_id: tournamentId,
        participants,
      });
      return ack({ success: true, data: { tournament_id: tournamentId, participants } });
    } catch (err) {
      console.error("[tournament:leave] error", err);
      return ack({ success: false, message: "Failed to leave tournament." });
    }
  });
}
