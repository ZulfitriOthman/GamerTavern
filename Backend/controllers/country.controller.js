// Backend/controllers/country.controller.js
//
// Migrated to the NanashiCollectibles v2 `countries` table. The legacy `COUNTRIES`
// table this used to query (COUNTRY_NAME/COUNTRY_CODE/COUNTRY_FLAG) was never present
// in Database/All.sql at all — its real shape was unconfirmed — so this is a clean
// replacement against the new canonical table, not a column rename.
export default function countrySocketController({ socket, db }) {
  socket.on("country:list", async (_payload, ack) => {
    try {
      const [rows] = await db.query(
        "SELECT id, name, iso_code AS isoCode, calling_code AS callingCode, flag FROM countries ORDER BY name"
      );
      const data = rows || [];

      // Support both ack-style and event-style consumers
      if (typeof ack === "function") ack({ success: true, data });
      socket.emit("country:list", data);
    } catch (err) {
      console.error("[country.controller] country:list error:", err?.message || err);
      if (typeof ack === "function") ack({ success: false, data: [], message: err?.message });
      socket.emit("country:list", []);
    }
  });
}
