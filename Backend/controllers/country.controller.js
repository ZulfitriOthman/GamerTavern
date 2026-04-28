// Backend/controllers/country.controller.js
export default function countrySocketController({ socket, db }) {
  socket.on("country:list", async (_payload, ack) => {
    try {
      const [rows] = await db.query(
        "SELECT COUNTRY_NAME AS name, COUNTRY_CODE AS dial, COUNTRY_FLAG AS code FROM COUNTRIES ORDER BY ID"
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
