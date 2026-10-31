// SCHEMA-ONLY backup of the live ticketing tables (structure only — all 12
// present tables currently hold 0 rows per the read-only inspection, so no
// data dump is needed; this captures SHOW CREATE TABLE for each, per the
// project's documented mysql2-based backup fallback in Database/README.md
// "How to back up the database").
//
// Read-only against the live DB (only SHOW CREATE TABLE + information_schema
// queries). Writes exactly one new file under Database/backups/.
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

dotenv.config({ path: "D:/Github/GamerTavern/Backend/.env.dev" });

const TICKETING_TABLES_PRESENT = [
  "VENUE_LAYOUTS", "VENUE_SECTIONS", "VENUE_SEATS",
  "EVENTS", "TICKET_TYPES", "EVENT_SECTIONS", "EVENT_SEATS",
  "TICKET_HOLDS", "TICKET_ORDERS", "TICKET_ORDER_ITEMS",
  "TICKET_PAYMENT_TRANSACTIONS", "EVENT_TICKETS",
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  const dbName = process.env.MYSQL_DATABASE;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");
  const outPath = path.join(
    "D:/Github/GamerTavern/Database/backups",
    `ticketing_schema_only_${stamp}.sql`
  );

  let out = `-- Schema-only backup of live ticketing tables in \`${dbName}\`\n`;
  out += `-- Generated ${new Date().toISOString()} by _backup_live_ticketing_schema.mjs\n`;
  out += `-- Structure only (all tables below had 0 rows at capture time). Does NOT include TICKET_HOLD_SESSIONS (not present live).\n\n`;

  for (const t of TICKETING_TABLES_PRESENT) {
    const [[row]] = await conn.query(`SHOW CREATE TABLE \`${t}\``);
    out += `-- ----------------------------------------------------------------\n`;
    out += `-- ${t}\n`;
    out += `-- ----------------------------------------------------------------\n`;
    out += row["Create Table"] + ";\n\n";
  }

  fs.writeFileSync(outPath, out, "utf8");
  console.log(`Wrote schema-only backup: ${outPath}`);
  console.log(`Tables captured: ${TICKETING_TABLES_PRESENT.length}`);

  await conn.end();
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
