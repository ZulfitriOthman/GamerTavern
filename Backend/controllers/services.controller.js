// Backend/controllers/services.controller.js
//
// New controller (no legacy equivalent existed) backing the NanashiCollectibles
// v2 `services` and `enquiries` tables. Deliberately minimal per this phase's
// scope: public service catalogue + public enquiry submission only. No admin
// enquiry management here yet — that's a real "later" item, not an oversight
// (see CLAUDE.md).
const toStr = (v) => (v == null ? "" : String(v)).trim();
const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_TOPICS = new Set(["general", "shop", "tcg", "esports", "service"]);

export default function servicesSocketController({ socket, db }) {
  /* =========================================================
     LIST SERVICES (public) — active only
     ========================================================= */
  socket.on("services:list", async (_payload, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};
    try {
      const [rows] = await db.query(
        `SELECT id, name, slug, category, summary, description
         FROM SERVICES
         WHERE status = 'active'
         ORDER BY name`
      );
      return ack({ success: true, data: rows || [] });
    } catch (err) {
      console.error("[services:list] error", err);
      return ack({ success: false, message: "Failed to load services." });
    }
  });

  /* =========================================================
     SUBMIT ENQUIRY (public)
     Deliberately does NOT io.emit() — enquiries carry PII (email/phone/message)
     and must not be broadcast to every connected socket the way public
     product/tournament updates are.
     ========================================================= */
  socket.on("enquiries:create", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const topic = toStr(payload.topic);
    const name = toStr(payload.name);
    const email = toStr(payload.email).toLowerCase();
    const phone = toStr(payload.phone) || null;
    const message = toStr(payload.message);
    const serviceId = payload.serviceId != null ? toInt(payload.serviceId) : null;

    if (!VALID_TOPICS.has(topic)) {
      return ack({
        success: false,
        message: `topic must be one of: ${Array.from(VALID_TOPICS).join(", ")}.`,
      });
    }
    if (!name || !email || !message) {
      return ack({ success: false, message: "name, email, and message are required." });
    }
    if (!EMAIL_REGEX.test(email)) {
      return ack({ success: false, message: "Invalid email format." });
    }
    if (topic === "service" && !serviceId) {
      return ack({ success: false, message: "serviceId is required for service enquiries." });
    }

    try {
      const [result] = await db.execute(
        `INSERT INTO ENQUIRIES (service_id, topic, name, email, phone, message)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [serviceId, topic, name, email, phone, message]
      );

      return ack({
        success: true,
        message: "Enquiry received.",
        data: { id: result.insertId },
      });
    } catch (err) {
      if (err?.code === "ER_NO_REFERENCED_ROW_2" || err?.code === "ER_NO_REFERENCED_ROW") {
        return ack({ success: false, message: "Unknown serviceId." });
      }
      console.error("[enquiries:create] error", err);
      return ack({ success: false, message: "Failed to submit enquiry." });
    }
  });
}
