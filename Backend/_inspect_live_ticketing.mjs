// READ-ONLY inspection of the live database's current ticketing table state.
// Issues only SELECT statements against information_schema — never writes,
// never touches application data. Uses the project's normal .env.dev
// connection (already scoped to nanashi_collectibles only).
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: "D:/Github/GamerTavern/Backend/.env.dev" });

const EXPECTED_TABLES = [
  "VENUE_LAYOUTS", "VENUE_SECTIONS", "VENUE_SEATS",
  "EVENTS", "TICKET_TYPES", "EVENT_SECTIONS", "EVENT_SEATS",
  "TICKET_HOLD_SESSIONS", "TICKET_HOLDS",
  "TICKET_ORDERS", "TICKET_ORDER_ITEMS",
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

  const [tables] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
    [dbName]
  );
  const allTableNames = tables.map((t) => t.TABLE_NAME);
  const found = EXPECTED_TABLES.filter((t) => allTableNames.includes(t));
  const missing = EXPECTED_TABLES.filter((t) => !allTableNames.includes(t));

  console.log(`Total tables in ${dbName}: ${allTableNames.length}`);
  console.log(`Ticketing tables found (${found.length}/${EXPECTED_TABLES.length}):`, found);
  console.log(`Ticketing tables MISSING:`, missing);

  if (found.length === 0) {
    console.log("\nNo ticketing tables present live. Nothing further to inspect.");
    await conn.end();
    return;
  }

  const [columns] = await conn.query(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${found.map(() => "?").join(",")})
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [dbName, ...found]
  );

  const [fks] = await conn.query(
    `SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL AND TABLE_NAME IN (${found.map(() => "?").join(",")})
     ORDER BY TABLE_NAME, CONSTRAINT_NAME`,
    [dbName, ...found]
  );

  const [rc] = await conn.query(
    `SELECT TABLE_NAME, CONSTRAINT_NAME, UPDATE_RULE, DELETE_RULE
     FROM information_schema.REFERENTIAL_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME IN (${found.map(() => "?").join(",")})
     ORDER BY TABLE_NAME, CONSTRAINT_NAME`,
    [dbName, ...found]
  );

  const [indexes] = await conn.query(
    `SELECT TABLE_NAME, INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLS, NON_UNIQUE
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${found.map(() => "?").join(",")})
     GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
     ORDER BY TABLE_NAME, INDEX_NAME`,
    [dbName, ...found]
  );

  console.log("\n=== COLUMNS ===");
  console.log(JSON.stringify(columns, null, 2));
  console.log("\n=== FOREIGN KEYS (column-level) ===");
  console.log(JSON.stringify(fks, null, 2));
  console.log("\n=== FOREIGN KEYS (ON UPDATE/DELETE rules) ===");
  console.log(JSON.stringify(rc, null, 2));
  console.log("\n=== INDEXES ===");
  console.log(JSON.stringify(indexes, null, 2));

  console.log("\n=== ROW COUNTS (existing data check) ===");
  for (const t of found) {
    const [[{ cnt }]] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${t}\``);
    console.log(`  ${t}: ${cnt} row(s)`);
  }

  await conn.end();
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
