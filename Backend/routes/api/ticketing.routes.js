// Backend/routes/api/ticketing.routes.js
//
// Stage 3 — ticket inventory availability + hold create/release REST
// surface. Mirrors checkout.routes.js's conventions (requireAuth,
// { success, code, message, data } response shape, audit logging).
// Never trusts client-supplied price/userId/seat-status/availability/
// expiry — every write re-validates against the live database inside a
// transaction (see services/ticketing/ticketHoldService.js).
import { Router } from "express";
import { requireAuth, optionalAuth } from "../../modules/restAuth.module.js";
import { writeAuditLog } from "../../modules/auditLog.module.js";
import { initializeEventInventory, InventoryError } from "../../services/ticketing/ticketInventoryService.js";
import { createHold, releaseHold, getHoldSession, HoldError } from "../../services/ticketing/ticketHoldService.js";

function requireAdmin(req, res, next) {
  if (String(req.user?.role || "").toUpperCase() !== "ADMIN") {
    return res.status(403).json({ success: false, code: "ADMIN_REQUIRED", message: "Admin privileges required." });
  }
  next();
}

function sendServiceError(res, err, fallbackMessage) {
  if (err instanceof HoldError || err instanceof InventoryError) {
    return res.status(err.httpStatus || 400).json({ success: false, code: err.code, message: err.message });
  }
  console.error("[ticketing.routes]", err);
  return res.status(500).json({ success: false, message: fallbackMessage });
}

export default function createTicketingRoutes({ db, io }) {
  const router = Router();

  // Public read: event section/seat availability, for the seat-map page
  // (Stage 5). No auth required — matches how product/tournament listing
  // reads work elsewhere in this codebase.
  router.get("/events/:eventId/availability", optionalAuth, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!Number.isInteger(eventId) || eventId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid eventId." });
    }

    try {
      const [eventRows] = await db.query(
        `SELECT ID, NAME, SLUG, STATUS, SALE_STATUS, START_AT, PER_CUSTOMER_LIMIT FROM EVENTS WHERE ID = ? LIMIT 1`,
        [eventId]
      );
      const event = eventRows[0];
      if (!event || event.STATUS === "draft") {
        return res.status(404).json({ success: false, code: "EVENT_NOT_FOUND", message: "Event not found." });
      }

      const [sections] = await db.query(
        `SELECT es.ID AS eventSectionId, vs.CODE AS sectionCode, vs.NAME AS sectionName, vs.CATEGORY AS category,
                tt.ID AS ticketTypeId, tt.CODE AS ticketTypeCode, tt.NAME AS ticketTypeName, tt.PRICE AS price, tt.COLOR_TOKEN AS colorToken,
                COALESCE(es.CAPACITY_OVERRIDE, vs.CAPACITY) AS capacity, es.HELD_QUANTITY AS held, es.SOLD_QUANTITY AS sold, es.IS_DISABLED AS isDisabled
           FROM EVENT_SECTIONS es
           JOIN VENUE_SECTIONS vs ON vs.ID = es.SECTION_ID
           JOIN TICKET_TYPES tt ON tt.ID = es.TICKET_TYPE_ID
          WHERE es.EVENT_ID = ?
          ORDER BY vs.SORT_ORDER, vs.ID`,
        [eventId]
      );

      const [seats] = await db.query(
        `SELECT es.ID AS eventSeatId, vs.ID AS venueSeatId, sec.CODE AS sectionCode, vs.ROW_LABEL AS rowLabel, vs.SEAT_NUMBER AS seatNumber,
                vs.SEAT_CODE AS seatCode, vs.IS_ACCESSIBLE AS isAccessible, vs.IS_OBSTRUCTED_VIEW AS isObstructedView,
                es.STATUS AS status, tt.ID AS ticketTypeId, COALESCE(es.PRICE_OVERRIDE, tt.PRICE) AS price
           FROM EVENT_SEATS es
           JOIN VENUE_SEATS vs ON vs.ID = es.VENUE_SEAT_ID
           JOIN VENUE_SECTIONS sec ON sec.ID = vs.SECTION_ID
           JOIN TICKET_TYPES tt ON tt.ID = es.TICKET_TYPE_ID
          WHERE es.EVENT_ID = ?`,
        [eventId]
      );

      return res.json({
        success: true,
        data: {
          event: { id: event.ID, name: event.NAME, slug: event.SLUG, saleStatus: event.SALE_STATUS, startAt: event.START_AT, perCustomerLimit: event.PER_CUSTOMER_LIMIT },
          sections: sections.map((s) => ({ ...s, available: Math.max(0, s.capacity - s.held - s.sold) })),
          seats,
        },
      });
    } catch (err) {
      console.error("[ticketing/availability] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load availability." });
    }
  });

  router.post("/events/:eventId/holds", requireAuth, async (req, res) => {
    const eventId = Number(req.params.eventId);
    const { idempotencyKey, items } = req.body || {};
    if (!Number.isInteger(eventId) || eventId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid eventId." });
    }
    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      return res.status(400).json({ success: false, code: "IDEMPOTENCY_KEY_REQUIRED", message: "idempotencyKey is required." });
    }

    try {
      const session = await createHold(db, io, { userId: req.user.sub, eventId, idempotencyKey, items });
      await writeAuditLog(db, { actorUserId: req.user.sub, action: "TICKET_HOLD_CREATED", entityType: "ticket_hold_session", entityId: session.id, metadata: { eventId, itemCount: session.holds.length } });
      return res.status(201).json({ success: true, data: session });
    } catch (err) {
      return sendServiceError(res, err, "Failed to create hold.");
    }
  });

  router.get("/holds/:holdSessionId", requireAuth, async (req, res) => {
    const holdSessionId = Number(req.params.holdSessionId);
    if (!Number.isInteger(holdSessionId) || holdSessionId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid holdSessionId." });
    }
    try {
      const isAdmin = String(req.user?.role || "").toUpperCase() === "ADMIN";
      const session = await getHoldSession(db, { holdSessionId, userId: req.user.sub, isAdmin });
      return res.json({ success: true, data: session });
    } catch (err) {
      return sendServiceError(res, err, "Failed to load hold session.");
    }
  });

  router.delete("/holds/:holdSessionId", requireAuth, async (req, res) => {
    const holdSessionId = Number(req.params.holdSessionId);
    if (!Number.isInteger(holdSessionId) || holdSessionId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid holdSessionId." });
    }
    try {
      const isAdmin = String(req.user?.role || "").toUpperCase() === "ADMIN";
      const result = await releaseHold(db, io, { holdSessionId, userId: req.user.sub, isAdmin });
      await writeAuditLog(db, { actorUserId: req.user.sub, action: "TICKET_HOLD_RELEASED", entityType: "ticket_hold_session", entityId: holdSessionId, metadata: result });
      return res.json({ success: true, data: result });
    } catch (err) {
      return sendServiceError(res, err, "Failed to release hold.");
    }
  });

  // Admin-only: generate EVENT_SECTIONS/EVENT_SEATS for an event from its
  // venue layout. Body: { categoryToTicketTypeId: { vip, standard, general_admission } }.
  router.post("/admin/events/:eventId/initialize-inventory", requireAuth, requireAdmin, async (req, res) => {
    const eventId = Number(req.params.eventId);
    const { categoryToTicketTypeId } = req.body || {};
    if (!Number.isInteger(eventId) || eventId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid eventId." });
    }
    try {
      const result = await initializeEventInventory(db, { eventId, categoryToTicketTypeId });
      await writeAuditLog(db, { actorUserId: req.user.sub, action: "TICKET_INVENTORY_INITIALIZED", entityType: "event", entityId: eventId, metadata: result });
      return res.json({ success: true, data: result });
    } catch (err) {
      return sendServiceError(res, err, "Failed to initialize inventory.");
    }
  });

  return router;
}
