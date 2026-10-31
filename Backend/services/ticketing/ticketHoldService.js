// Backend/services/ticketing/ticketHoldService.js
//
// Stage 3 — reserved-seat and GA hold creation/release, following the
// concurrency/idempotency/emit rules documented in the header comment of
// Database/schema/009_ticketing.sql:
//   - Deterministic lock order: EVENT_SECTIONS (ascending ID) before
//     EVENT_SEATS (ascending ID), every code path that can touch both.
//   - All-or-nothing: one unavailable resource fails the whole request.
//   - Idempotent creation: (USER_ID, IDEMPOTENCY_KEY) on
//     TICKET_HOLD_SESSIONS — a repeated request returns the existing
//     session instead of creating a second one.
//   - Idempotent release: conditional UPDATE ... WHERE STATUS='ACTIVE' /
//     WHERE CURRENT_HOLD_ID=? / WHERE HELD_QUANTITY>=? so a race between
//     two release triggers (expiry sweep, user cancel, checkout failure,
//     admin action) can only ever succeed once.
//   - Socket.IO broadcast only AFTER commit, never before/instead of a
//     rollback. The database is always authoritative.
//
// Server is authoritative for price and expiry — never accepted from the
// client. Never trust frontend-supplied seat status/availability.
import crypto from "crypto";

export const HOLD_DURATION_MINUTES = 10;
const MAX_ITEMS_PER_REQUEST = 20;
const GA_CATEGORY = "general_admission";

export class HoldError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function logEvent(event, fields) {
  // Structured, no secrets — see Database/README.md / schema header:
  // never log passwords, payment tokens, raw QR tokens, session
  // secrets, or DB credentials. Only IDs/quantities/statuses here.
  console.log(`[ticketing] ${event}`, JSON.stringify(fields));
}

function normalizeItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new HoldError("ITEMS_REQUIRED", "At least one seat or GA item is required.");
  }
  if (rawItems.length > MAX_ITEMS_PER_REQUEST) {
    throw new HoldError("TOO_MANY_ITEMS", `A single hold request may contain at most ${MAX_ITEMS_PER_REQUEST} items.`);
  }

  const seatIds = new Set();
  const sectionQuantities = new Map(); // eventSectionId -> quantity

  for (const raw of rawItems) {
    if (raw?.type === "seat") {
      const eventSeatId = Number(raw.eventSeatId);
      if (!Number.isInteger(eventSeatId) || eventSeatId <= 0) {
        throw new HoldError("INVALID_ITEM", "A seat item requires a valid eventSeatId.");
      }
      if (seatIds.has(eventSeatId)) {
        throw new HoldError("DUPLICATE_ITEM", `Seat ${eventSeatId} was requested more than once.`);
      }
      seatIds.add(eventSeatId);
    } else if (raw?.type === "ga") {
      const eventSectionId = Number(raw.eventSectionId);
      const quantity = Number(raw.quantity);
      if (!Number.isInteger(eventSectionId) || eventSectionId <= 0) {
        throw new HoldError("INVALID_ITEM", "A GA item requires a valid eventSectionId.");
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new HoldError("INVALID_ITEM", "A GA item requires a positive integer quantity.");
      }
      if (sectionQuantities.has(eventSectionId)) {
        throw new HoldError("DUPLICATE_ITEM", `GA section ${eventSectionId} was requested more than once — combine into a single item.`);
      }
      sectionQuantities.set(eventSectionId, quantity);
    } else {
      throw new HoldError("INVALID_ITEM", 'Each item must have type "seat" or "ga".');
    }
  }

  return {
    seatIds: [...seatIds].sort((a, b) => a - b),
    sections: [...sectionQuantities.entries()].map(([eventSectionId, quantity]) => ({ eventSectionId, quantity })).sort((a, b) => a.eventSectionId - b.eventSectionId),
  };
}

async function checkPurchaseLimits(conn, { eventId, userId, requestedBySeatType, eventLimit }) {
  const [[{ activeQty }]] = await conn.query(
    `SELECT COALESCE(SUM(th.QUANTITY), 0) AS activeQty
       FROM TICKET_HOLDS th
       JOIN TICKET_HOLD_SESSIONS ths ON ths.ID = th.HOLD_SESSION_ID
      WHERE ths.USER_ID = ? AND ths.EVENT_ID = ? AND ths.STATUS = 'ACTIVE' AND th.STATUS = 'ACTIVE'`,
    [userId, eventId]
  );
  const [[{ purchasedQty }]] = await conn.query(
    `SELECT COUNT(*) AS purchasedQty FROM EVENT_TICKETS WHERE USER_ID = ? AND EVENT_ID = ? AND STATUS IN ('ISSUED','USED')`,
    [userId, eventId]
  );
  const requestedTotal = [...requestedBySeatType.values()].reduce((sum, q) => sum + q, 0);

  if (activeQty + purchasedQty + requestedTotal > eventLimit) {
    throw new HoldError(
      "PURCHASE_LIMIT_EXCEEDED",
      `This request would exceed the ${eventLimit}-ticket limit per customer for this event.`,
      409
    );
  }

  for (const [ticketTypeId, requestedQty] of requestedBySeatType.entries()) {
    const [[typeRow]] = await conn.query(`SELECT MAX_PER_CUSTOMER FROM TICKET_TYPES WHERE ID = ?`, [ticketTypeId]);
    if (!typeRow?.MAX_PER_CUSTOMER) continue;

    const [[{ activeTypeQty }]] = await conn.query(
      `SELECT COALESCE(SUM(th.QUANTITY), 0) AS activeTypeQty
         FROM TICKET_HOLDS th
         JOIN TICKET_HOLD_SESSIONS ths ON ths.ID = th.HOLD_SESSION_ID
         LEFT JOIN EVENT_SEATS es ON es.ID = th.EVENT_SEAT_ID
         LEFT JOIN EVENT_SECTIONS sec ON sec.ID = th.EVENT_SECTION_ID
        WHERE ths.USER_ID = ? AND ths.EVENT_ID = ? AND ths.STATUS = 'ACTIVE' AND th.STATUS = 'ACTIVE'
          AND (es.TICKET_TYPE_ID = ? OR sec.TICKET_TYPE_ID = ?)`,
      [userId, eventId, ticketTypeId, ticketTypeId]
    );
    const [[{ purchasedTypeQty }]] = await conn.query(
      `SELECT COUNT(*) AS purchasedTypeQty
         FROM EVENT_TICKETS et
         JOIN TICKET_ORDER_ITEMS oi ON oi.ID = et.TICKET_ORDER_ITEM_ID
        WHERE et.USER_ID = ? AND et.EVENT_ID = ? AND et.STATUS IN ('ISSUED','USED') AND oi.TICKET_TYPE_ID = ?`,
      [userId, eventId, ticketTypeId]
    );
    if (activeTypeQty + purchasedTypeQty + requestedQty > typeRow.MAX_PER_CUSTOMER) {
      throw new HoldError(
        "TYPE_PURCHASE_LIMIT_EXCEEDED",
        `This request would exceed the per-customer limit for this ticket type.`,
        409
      );
    }
  }
}

export async function createHold(db, io, { userId, eventId, idempotencyKey, items }) {
  if (!userId) throw new HoldError("AUTH_REQUIRED", "Authentication required.", 401);
  if (!eventId) throw new HoldError("EVENT_ID_REQUIRED", "eventId is required.");
  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    throw new HoldError("IDEMPOTENCY_KEY_REQUIRED", "idempotencyKey is required.");
  }
  const { seatIds, sections } = normalizeItems(items);

  // Fast-path idempotent replay — a genuine double-click/retry never
  // needs to re-lock anything.
  const [existingRows] = await db.query(
    `SELECT ID, EVENT_ID, STATUS, EXPIRES_AT FROM TICKET_HOLD_SESSIONS WHERE USER_ID = ? AND IDEMPOTENCY_KEY = ? LIMIT 1`,
    [userId, idempotencyKey]
  );
  if (existingRows[0]) {
    if (Number(existingRows[0].EVENT_ID) !== Number(eventId)) {
      throw new HoldError("IDEMPOTENCY_KEY_REUSED", "This idempotencyKey was already used for a different event.", 409);
    }
    return getHoldSession(db, { holdSessionId: existingRows[0].ID, userId, isAdmin: false });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [eventRows] = await conn.execute(
      `SELECT ID, STATUS, SALE_STATUS, PER_CUSTOMER_LIMIT FROM EVENTS WHERE ID = ? LIMIT 1`,
      [eventId]
    );
    const event = eventRows[0];
    if (!event) throw new HoldError("EVENT_NOT_FOUND", "Event not found.", 404);
    if (event.STATUS !== "published") throw new HoldError("EVENT_NOT_PUBLISHED", "This event is not currently on sale.", 409);
    if (event.SALE_STATUS !== "on_sale") throw new HoldError("SALES_NOT_OPEN", "Ticket sales are not currently open for this event.", 409);

    // 1. Lock EVENT_SECTIONS (ascending ID) first.
    let lockedSections = [];
    if (sections.length) {
      const [rows] = await conn.query(
        `SELECT es.ID, es.EVENT_ID, es.TICKET_TYPE_ID, es.HELD_QUANTITY, es.SOLD_QUANTITY, es.CAPACITY_OVERRIDE, es.IS_DISABLED,
                vs.CAPACITY AS VENUE_CAPACITY
           FROM EVENT_SECTIONS es
           JOIN VENUE_SECTIONS vs ON vs.ID = es.SECTION_ID
          WHERE es.ID IN (${sections.map(() => "?").join(",")})
          ORDER BY es.ID FOR UPDATE`,
        sections.map((s) => s.eventSectionId)
      );
      lockedSections = rows;
    }

    // 2. THEN lock EVENT_SEATS (ascending ID).
    let lockedSeats = [];
    if (seatIds.length) {
      const [rows] = await conn.query(
        `SELECT ID, EVENT_ID, TICKET_TYPE_ID, PRICE_OVERRIDE, STATUS
           FROM EVENT_SEATS WHERE ID IN (${seatIds.map(() => "?").join(",")})
          ORDER BY ID FOR UPDATE`,
        seatIds
      );
      lockedSeats = rows;
    }

    // 3. Validate every requested resource — all-or-nothing.
    const sectionById = new Map(lockedSections.map((s) => [s.ID, s]));
    for (const { eventSectionId, quantity } of sections) {
      const section = sectionById.get(eventSectionId);
      if (!section || Number(section.EVENT_ID) !== Number(eventId)) {
        throw new HoldError("SECTION_NOT_FOUND", `Section ${eventSectionId} does not belong to this event.`, 409);
      }
      if (section.IS_DISABLED) {
        throw new HoldError("SECTION_DISABLED", `Section ${eventSectionId} is not currently on sale.`, 409);
      }
      const capacity = section.CAPACITY_OVERRIDE ?? section.VENUE_CAPACITY;
      const available = capacity - section.HELD_QUANTITY - section.SOLD_QUANTITY;
      if (available < quantity) {
        logEvent("ga_capacity_conflict", { eventId, eventSectionId, requested: quantity, available });
        throw new HoldError("GA_CAPACITY_UNAVAILABLE", `Only ${available} tickets remain in this section.`, 409);
      }
    }

    const seatById = new Map(lockedSeats.map((s) => [s.ID, s]));
    for (const eventSeatId of seatIds) {
      const seat = seatById.get(eventSeatId);
      if (!seat || Number(seat.EVENT_ID) !== Number(eventId)) {
        throw new HoldError("SEAT_NOT_FOUND", `Seat ${eventSeatId} does not belong to this event.`, 409);
      }
      if (seat.STATUS !== "available") {
        logEvent("seat_conflict", { eventId, eventSeatId, status: seat.STATUS });
        throw new HoldError("SEAT_UNAVAILABLE", `Seat ${eventSeatId} is no longer available.`, 409);
      }
    }

    // 4. Resolve ticket-type prices (active types only).
    const ticketTypeIds = new Set([...lockedSections.map((s) => s.TICKET_TYPE_ID), ...lockedSeats.map((s) => s.TICKET_TYPE_ID)]);
    const ticketTypeById = new Map();
    if (ticketTypeIds.size) {
      const [typeRows] = await conn.query(
        `SELECT ID, PRICE, STATUS FROM TICKET_TYPES WHERE ID IN (${[...ticketTypeIds].map(() => "?").join(",")})`,
        [...ticketTypeIds]
      );
      for (const t of typeRows) {
        if (t.STATUS !== "active") throw new HoldError("TICKET_TYPE_UNAVAILABLE", "One of the requested ticket types is no longer on sale.", 409);
        ticketTypeById.set(t.ID, t);
      }
    }

    const seatPrice = (seat) => Number(seat.PRICE_OVERRIDE ?? ticketTypeById.get(seat.TICKET_TYPE_ID).PRICE);
    const sectionPrice = (section) => Number(ticketTypeById.get(section.TICKET_TYPE_ID).PRICE);

    const requestedBySeatType = new Map();
    for (const eventSeatId of seatIds) {
      const seat = seatById.get(eventSeatId);
      requestedBySeatType.set(seat.TICKET_TYPE_ID, (requestedBySeatType.get(seat.TICKET_TYPE_ID) || 0) + 1);
    }
    for (const { eventSectionId, quantity } of sections) {
      const section = sectionById.get(eventSectionId);
      requestedBySeatType.set(section.TICKET_TYPE_ID, (requestedBySeatType.get(section.TICKET_TYPE_ID) || 0) + quantity);
    }

    // 5. Purchase-limit validation (event-level + per-ticket-type override).
    await checkPurchaseLimits(conn, { eventId, userId, requestedBySeatType, eventLimit: event.PER_CUSTOMER_LIMIT });

    // 6. Claim the idempotency key / create the session.
    let sessionId;
    try {
      const [sessionResult] = await conn.execute(
        `INSERT INTO TICKET_HOLD_SESSIONS (EVENT_ID, USER_ID, IDEMPOTENCY_KEY, STATUS, EXPIRES_AT)
         VALUES (?, ?, ?, 'ACTIVE', DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
        [eventId, userId, idempotencyKey, HOLD_DURATION_MINUTES]
      );
      sessionId = sessionResult.insertId;
    } catch (err) {
      if (err?.code === "ER_DUP_ENTRY") {
        // A concurrent duplicate request won the race — roll back this
        // transaction's speculative locks/checks and hand back the
        // session the other request actually created.
        await conn.rollback();
        const [rows] = await db.query(`SELECT ID FROM TICKET_HOLD_SESSIONS WHERE USER_ID = ? AND IDEMPOTENCY_KEY = ? LIMIT 1`, [userId, idempotencyKey]);
        if (rows[0]) return getHoldSession(db, { holdSessionId: rows[0].ID, userId, isAdmin: false });
      }
      throw err;
    }

    const createdHolds = [];
    for (const eventSeatId of seatIds) {
      const seat = seatById.get(eventSeatId);
      const unitPrice = seatPrice(seat);
      const [holdResult] = await conn.execute(
        `INSERT INTO TICKET_HOLDS (HOLD_SESSION_ID, EVENT_ID, EVENT_SEAT_ID, QUANTITY, UNIT_PRICE, STATUS)
         VALUES (?, ?, ?, 1, ?, 'ACTIVE')`,
        [sessionId, eventId, eventSeatId, unitPrice]
      );
      await conn.execute(`UPDATE EVENT_SEATS SET STATUS = 'held', CURRENT_HOLD_ID = ?, UPDATED_AT = NOW() WHERE ID = ?`, [holdResult.insertId, eventSeatId]);
      createdHolds.push({ id: holdResult.insertId, type: "seat", eventSeatId, quantity: 1, unitPrice });
    }
    for (const { eventSectionId, quantity } of sections) {
      const section = sectionById.get(eventSectionId);
      const unitPrice = sectionPrice(section);
      const [holdResult] = await conn.execute(
        `INSERT INTO TICKET_HOLDS (HOLD_SESSION_ID, EVENT_ID, EVENT_SECTION_ID, QUANTITY, UNIT_PRICE, STATUS)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
        [sessionId, eventId, eventSectionId, quantity, unitPrice]
      );
      await conn.execute(`UPDATE EVENT_SECTIONS SET HELD_QUANTITY = HELD_QUANTITY + ?, UPDATED_AT = NOW() WHERE ID = ?`, [quantity, eventSectionId]);
      createdHolds.push({ id: holdResult.insertId, type: "ga", eventSectionId, quantity, unitPrice });
    }

    await conn.commit();

    logEvent("hold_created", { holdSessionId: sessionId, eventId, userId, itemCount: createdHolds.length });

    for (const h of createdHolds) {
      if (h.type === "seat") {
        io?.emit("ticket:seat_held", { eventId, eventSeatId: h.eventSeatId, holdId: h.id });
      } else {
        io?.emit("ticket:inventory_updated", { eventId, eventSectionId: h.eventSectionId });
      }
    }

    return getHoldSession(db, { holdSessionId: sessionId, userId, isAdmin: false });
  } catch (err) {
    try {
      await conn?.rollback();
    } catch {}
    if (err instanceof HoldError) throw err;
    console.error("[ticketHoldService] createHold error:", err);
    throw new HoldError("HOLD_CREATE_FAILED", "Failed to create hold.", 500);
  } finally {
    try {
      conn?.release();
    } catch {}
  }
}

export async function getHoldSession(db, { holdSessionId, userId, isAdmin = false }) {
  const [sessionRows] = await db.query(
    `SELECT ID, EVENT_ID, USER_ID, STATUS, EXPIRES_AT, CREATED_AT FROM TICKET_HOLD_SESSIONS WHERE ID = ? LIMIT 1`,
    [holdSessionId]
  );
  const session = sessionRows[0];
  if (!session) throw new HoldError("HOLD_SESSION_NOT_FOUND", "Hold session not found.", 404);
  if (!isAdmin && Number(session.USER_ID) !== Number(userId)) {
    throw new HoldError("FORBIDDEN", "This hold session does not belong to you.", 403);
  }

  const [holds] = await db.query(
    `SELECT ID, EVENT_SEAT_ID, EVENT_SECTION_ID, QUANTITY, UNIT_PRICE, STATUS FROM TICKET_HOLDS WHERE HOLD_SESSION_ID = ? ORDER BY ID`,
    [holdSessionId]
  );

  return {
    id: session.ID,
    eventId: session.EVENT_ID,
    status: session.STATUS,
    expiresAt: session.EXPIRES_AT,
    createdAt: session.CREATED_AT,
    holds: holds.map((h) => ({
      id: h.ID,
      type: h.EVENT_SEAT_ID ? "seat" : "ga",
      eventSeatId: h.EVENT_SEAT_ID,
      eventSectionId: h.EVENT_SECTION_ID,
      quantity: h.QUANTITY,
      unitPrice: Number(h.UNIT_PRICE),
      status: h.STATUS,
    })),
  };
}

// Shared by releaseHold (user/admin-triggered) and expireStaleHolds
// (system-triggered) — the conditional-UPDATE pattern below is what
// makes concurrent release attempts on the same session safe.
async function releaseSessionInternal(db, io, { sessionId, eventId, targetStatus }) {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [result] = await conn.execute(
      `UPDATE TICKET_HOLD_SESSIONS SET STATUS = ?, UPDATED_AT = NOW() WHERE ID = ? AND STATUS = 'ACTIVE'`,
      [targetStatus, sessionId]
    );
    if (result.affectedRows === 0) {
      await conn.rollback();
      return { released: false, alreadyHandled: true };
    }

    const [holds] = await conn.query(
      `SELECT ID, EVENT_SEAT_ID, EVENT_SECTION_ID, QUANTITY, STATUS FROM TICKET_HOLDS WHERE HOLD_SESSION_ID = ? AND STATUS = 'ACTIVE'`,
      [sessionId]
    );

    const gaHolds = holds.filter((h) => h.EVENT_SECTION_ID != null).sort((a, b) => a.EVENT_SECTION_ID - b.EVENT_SECTION_ID);
    const seatHolds = holds.filter((h) => h.EVENT_SEAT_ID != null).sort((a, b) => a.EVENT_SEAT_ID - b.EVENT_SEAT_ID);

    const releasedSections = [];
    for (const h of gaHolds) {
      await conn.execute(
        `UPDATE EVENT_SECTIONS SET HELD_QUANTITY = HELD_QUANTITY - ?, UPDATED_AT = NOW() WHERE ID = ? AND HELD_QUANTITY >= ?`,
        [h.QUANTITY, h.EVENT_SECTION_ID, h.QUANTITY]
      );
      await conn.execute(`UPDATE TICKET_HOLDS SET STATUS = ?, UPDATED_AT = NOW() WHERE ID = ?`, [targetStatus, h.ID]);
      releasedSections.push(h.EVENT_SECTION_ID);
    }

    const releasedSeats = [];
    for (const h of seatHolds) {
      await conn.execute(
        `UPDATE EVENT_SEATS SET STATUS = 'available', CURRENT_HOLD_ID = NULL, UPDATED_AT = NOW() WHERE ID = ? AND CURRENT_HOLD_ID = ?`,
        [h.EVENT_SEAT_ID, h.ID]
      );
      await conn.execute(`UPDATE TICKET_HOLDS SET STATUS = ?, UPDATED_AT = NOW() WHERE ID = ?`, [targetStatus, h.ID]);
      releasedSeats.push(h.EVENT_SEAT_ID);
    }

    await conn.commit();

    logEvent(targetStatus === "EXPIRED" ? "hold_expired" : "hold_released", { holdSessionId: sessionId, eventId, releasedSeats: releasedSeats.length, releasedSections: releasedSections.length });

    for (const eventSeatId of releasedSeats) io?.emit("ticket:seat_released", { eventId, eventSeatId });
    for (const eventSectionId of releasedSections) io?.emit("ticket:inventory_updated", { eventId, eventSectionId });

    return { released: true, holdSessionId: sessionId, releasedSeats: releasedSeats.length, releasedSections: releasedSections.length };
  } catch (err) {
    try {
      await conn?.rollback();
    } catch {}
    console.error("[ticketHoldService] release error:", err);
    throw new HoldError("HOLD_RELEASE_FAILED", "Failed to release hold.", 500);
  } finally {
    try {
      conn?.release();
    } catch {}
  }
}

export async function releaseHold(db, io, { holdSessionId, userId, isAdmin = false }) {
  const [sessionRows] = await db.query(`SELECT ID, EVENT_ID, USER_ID, STATUS FROM TICKET_HOLD_SESSIONS WHERE ID = ? LIMIT 1`, [holdSessionId]);
  const session = sessionRows[0];
  if (!session) throw new HoldError("HOLD_SESSION_NOT_FOUND", "Hold session not found.", 404);
  if (!isAdmin && Number(session.USER_ID) !== Number(userId)) {
    throw new HoldError("FORBIDDEN", "This hold session does not belong to you.", 403);
  }
  return releaseSessionInternal(db, io, { sessionId: session.ID, eventId: session.EVENT_ID, targetStatus: "RELEASED" });
}

// Intended to be called periodically (see server.js) — best-effort, safe
// to call concurrently or overlap with a manual release for the same
// session (the conditional UPDATE inside releaseSessionInternal makes
// only the first attempt actually change anything).
export async function expireStaleHolds(db, io, { batchSize = 50 } = {}) {
  const [rows] = await db.query(
    `SELECT ID, EVENT_ID FROM TICKET_HOLD_SESSIONS WHERE STATUS = 'ACTIVE' AND EXPIRES_AT < NOW() ORDER BY ID LIMIT ?`,
    [batchSize]
  );
  let expiredCount = 0;
  for (const row of rows) {
    const result = await releaseSessionInternal(db, io, { sessionId: row.ID, eventId: row.EVENT_ID, targetStatus: "EXPIRED" });
    if (result.released) expiredCount += 1;
  }
  return { expiredCount, checked: rows.length };
}

export function generateIdempotencyKey() {
  return crypto.randomUUID();
}
