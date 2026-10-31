// Backend/services/ticketing/ticketInventoryService.js
//
// Stage 3 — event inventory generation. Implements the algorithm
// documented in Database/schema/009_ticketing.sql's header comment
// ("EVENT INVENTORY GENERATION"): given an EVENT_ID (whose
// EVENTS.VENUE_LAYOUT_ID is already set) and a VENUE_SECTIONS.CATEGORY
// -> TICKET_TYPES.ID mapping, upserts one EVENT_SECTIONS row per
// VENUE_SECTIONS row under that layout, and one EVENT_SEATS row per
// VENUE_SEATS row under a non-GA section. GA sections get no EVENT_SEATS
// rows — their inventory is the EVENT_SECTIONS.HELD_QUANTITY/
// SOLD_QUANTITY counters. Both steps run in one transaction so a failure
// partway through leaves nothing half-initialized. Idempotent — re-running
// with the same mapping is a no-op (UQ_EVENT_SECTIONS_EVENT_SECTION /
// UQ_EVENT_SEATS_EVENT_VENUE_SEAT), and never touches STATUS/
// CURRENT_HOLD_ID on an EVENT_SEATS row that already exists.

const GA_CATEGORY = "general_admission";

export async function initializeEventInventory(db, { eventId, categoryToTicketTypeId }) {
  if (!eventId) throw new InventoryError("EVENT_ID_REQUIRED", "eventId is required.");
  if (!categoryToTicketTypeId || typeof categoryToTicketTypeId !== "object") {
    throw new InventoryError("MAPPING_REQUIRED", "categoryToTicketTypeId mapping is required.");
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [eventRows] = await conn.execute(`SELECT ID, VENUE_LAYOUT_ID FROM EVENTS WHERE ID = ? LIMIT 1 FOR UPDATE`, [eventId]);
    const event = eventRows[0];
    if (!event) {
      await conn.rollback();
      throw new InventoryError("EVENT_NOT_FOUND", "Event does not exist.");
    }

    const [sections] = await conn.execute(
      `SELECT ID, CODE, CATEGORY, CAPACITY, STATUS FROM VENUE_SECTIONS WHERE VENUE_LAYOUT_ID = ? ORDER BY ID`,
      [event.VENUE_LAYOUT_ID]
    );
    if (!sections.length) {
      await conn.rollback();
      throw new InventoryError("NO_VENUE_SECTIONS", "This venue layout has no sections defined.");
    }

    const ticketTypeIds = new Set(Object.values(categoryToTicketTypeId).map(Number));
    if (ticketTypeIds.size) {
      const [typeRows] = await conn.query(
        `SELECT ID, EVENT_ID, STATUS FROM TICKET_TYPES WHERE ID IN (${[...ticketTypeIds].map(() => "?").join(",")})`,
        [...ticketTypeIds]
      );
      const byId = new Map(typeRows.map((t) => [t.ID, t]));
      for (const id of ticketTypeIds) {
        const t = byId.get(id);
        if (!t) {
          await conn.rollback();
          throw new InventoryError("TICKET_TYPE_NOT_FOUND", `Ticket type ${id} does not exist.`);
        }
        if (Number(t.EVENT_ID) !== Number(eventId)) {
          await conn.rollback();
          throw new InventoryError("TICKET_TYPE_MISMATCH", `Ticket type ${id} does not belong to event ${eventId}.`);
        }
      }
    }

    let sectionsInitialized = 0;
    let seatsInitialized = 0;

    for (const section of sections) {
      const ticketTypeId = categoryToTicketTypeId[section.CATEGORY];
      if (!ticketTypeId) {
        await conn.rollback();
        throw new InventoryError(
          "MISSING_CATEGORY_MAPPING",
          `No ticket type mapped for VENUE_SECTIONS category "${section.CATEGORY}" (section ${section.CODE}).`
        );
      }

      await conn.execute(
        `INSERT INTO EVENT_SECTIONS (EVENT_ID, SECTION_ID, TICKET_TYPE_ID)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE TICKET_TYPE_ID = VALUES(TICKET_TYPE_ID)`,
        [eventId, section.ID, ticketTypeId]
      );
      sectionsInitialized += 1;

      if (section.CATEGORY === GA_CATEGORY) continue; // no per-seat rows for GA

      const [venueSeats] = await conn.execute(
        `SELECT ID FROM VENUE_SEATS WHERE SECTION_ID = ? AND STATUS = 'active' ORDER BY ID`,
        [section.ID]
      );
      for (const seat of venueSeats) {
        await conn.execute(
          `INSERT INTO EVENT_SEATS (EVENT_ID, VENUE_SEAT_ID, TICKET_TYPE_ID, STATUS)
           VALUES (?, ?, ?, 'available')
           ON DUPLICATE KEY UPDATE TICKET_TYPE_ID = VALUES(TICKET_TYPE_ID)`,
          [eventId, seat.ID, ticketTypeId]
        );
        seatsInitialized += 1;
      }
    }

    await conn.commit();
    return { eventId, sectionsInitialized, seatsInitialized };
  } catch (err) {
    try {
      await conn?.rollback();
    } catch {}
    if (err instanceof InventoryError) throw err;
    console.error("[ticketInventoryService] initializeEventInventory error:", err);
    throw new InventoryError("INVENTORY_INIT_FAILED", "Failed to initialize event inventory.");
  } finally {
    try {
      conn?.release();
    } catch {}
  }
}

export class InventoryError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
