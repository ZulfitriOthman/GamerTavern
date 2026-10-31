// Scratch-database validation for the ticketing schema
// (Database/schema/009_ticketing.sql + Database/migrations/0002_add_ticketing.sql).
//
// This does NOT create or drop a database itself — an earlier attempt to do that
// against the project's configured .env.dev host failed with "Access denied"
// because that DB user only has privilege on nanashi_collectibles specifically.
// You must pre-create the scratch database(s) yourself (see the two "CREATE
// DATABASE" options below) and point this script at them via env vars.
//
// Usage:
//   node validate_ticketing_schema.mjs fresh       # loads schema/001 through 009 into a fresh DB
//   node validate_ticketing_schema.mjs migration   # loads schema/001-008, then migrations/0001, then migrations/0002
//   node validate_ticketing_schema.mjs both        # runs both modes (needs both DB env vars set) — default
//
// Required env vars (put these in Backend/.env.scratch and run with
// DOTENV_FILE=.env.scratch, or export them directly — never put scratch
// credentials in .env.dev):
//   SCRATCH_MYSQL_HOST, SCRATCH_MYSQL_PORT, SCRATCH_MYSQL_USER, SCRATCH_MYSQL_PASSWORD
//   SCRATCH_MYSQL_DATABASE_FRESH       (for `fresh` mode)
//   SCRATCH_MYSQL_DATABASE_MIGRATION   (for `migration` mode)
//
// Add --reset to DROP every table already in the target database first
// (only ever use this against a database you created specifically for this):
//   node validate_ticketing_schema.mjs fresh --reset
//
// ----------------------------------------------------------------------
// How to create the scratch database(s) — pick whichever matches your access:
//
// OPTION A — you have a MySQL/MariaDB admin account (local install, or a
// hosting provider's phpMyAdmin "SQL" tab with an admin-level login):
//
//   CREATE DATABASE nanashi_ticketing_scratch_fresh
//     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
//   CREATE DATABASE nanashi_ticketing_scratch_migration
//     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
//   CREATE USER 'ticketing_scratch'@'%' IDENTIFIED BY '<choose a real password>';
//   GRANT ALL PRIVILEGES ON nanashi_ticketing_scratch_fresh.*     TO 'ticketing_scratch'@'%';
//   GRANT ALL PRIVILEGES ON nanashi_ticketing_scratch_migration.* TO 'ticketing_scratch'@'%';
//   FLUSH PRIVILEGES;
//
// OPTION B — shared cPanel hosting (matches this project's live host per
// Database/README.md): cPanel -> "MySQL Databases" -> create
// nanashi_ticketing_scratch_fresh and nanashi_ticketing_scratch_migration
// (cPanel will prefix them with your account prefix) -> create a new
// database user -> "Add User to Database" for both, with ALL PRIVILEGES.
// cPanel-created users can't run CREATE DATABASE themselves, which is
// exactly why this script never attempts that either — it only ever loads
// DDL into databases that already exist.
// ----------------------------------------------------------------------
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

dotenv.config({ path: path.join(process.cwd(), process.env.DOTENV_FILE || ".env.dev") });

const SCHEMA_DIR = "D:/Github/GamerTavern/Database/schema";
const MIGRATIONS_DIR = "D:/Github/GamerTavern/Database/migrations";

const FRESH_FILES = [
  "001_core_auth.sql",
  "002_reference_data.sql",
  "003_catalog.sql",
  "004_merchants.sql",
  "005_orders_checkout.sql",
  "006_payments.sql",
  "007_content_community.sql",
  "008_platform_ops.sql",
  "009_ticketing.sql",
].map((f) => path.join(SCHEMA_DIR, f));

const PRE_TICKETING_FILES = [
  "001_core_auth.sql",
  "002_reference_data.sql",
  "003_catalog.sql",
  "004_merchants.sql",
  "005_orders_checkout.sql",
  "006_payments.sql",
  "007_content_community.sql",
  "008_platform_ops.sql",
].map((f) => path.join(SCHEMA_DIR, f));

const MIGRATION_FILES = [
  "0001_add_checkout_idempotency_and_bank_encryption.sql",
  "0002_add_ticketing.sql",
].map((f) => path.join(MIGRATIONS_DIR, f));

const TICKETING_TABLES = [
  "VENUE_LAYOUTS", "VENUE_SECTIONS", "VENUE_SEATS",
  "EVENTS", "TICKET_TYPES", "EVENT_SECTIONS", "EVENT_SEATS",
  "TICKET_HOLD_SESSIONS", "TICKET_HOLDS",
  "TICKET_ORDERS", "TICKET_ORDER_ITEMS",
  "TICKET_PAYMENT_TRANSACTIONS", "EVENT_TICKETS",
];

function splitStatements(sql) {
  const noComments = sql
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
  return noComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function runFiles(conn, files, label) {
  for (const full of files) {
    const sql = fs.readFileSync(full, "utf8");
    const statements = splitStatements(sql);
    for (const stmt of statements) {
      await conn.query(stmt);
    }
    console.log(`  [${label}] loaded ${path.basename(full)}`);
  }
}

async function resetDatabase(conn, dbName) {
  const [tables] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
    [dbName]
  );
  if (tables.length === 0) return;
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const t of tables) {
    await conn.query(`DROP TABLE IF EXISTS \`${t.TABLE_NAME}\``);
  }
  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  console.log(`  Reset: dropped ${tables.length} existing table(s) in ${dbName}`);
}

async function inspect(conn, dbName) {
  const [tables] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
    [dbName]
  );
  const [fks] = await conn.query(
    `SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
       AND TABLE_NAME IN (${TICKETING_TABLES.map(() => "?").join(",")})
     ORDER BY TABLE_NAME, CONSTRAINT_NAME`,
    [dbName, ...TICKETING_TABLES]
  );
  const [indexes] = await conn.query(
    `SELECT TABLE_NAME, INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLS, NON_UNIQUE
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${TICKETING_TABLES.map(() => "?").join(",")})
     GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
     ORDER BY TABLE_NAME, INDEX_NAME`,
    [dbName, ...TICKETING_TABLES]
  );

  const selfRefFk = fks.find(
    (r) => r.TABLE_NAME === "VENUE_SEATS" && r.CONSTRAINT_NAME === "FK_VENUE_SEATS_COMPANION"
  );
  const ticketingTablesFound = tables.map((t) => t.TABLE_NAME).filter((n) => TICKETING_TABLES.includes(n));
  const missingTicketingTables = TICKETING_TABLES.filter((n) => !ticketingTablesFound.includes(n));

  return {
    totalTables: tables.length,
    ticketingTablesFound: ticketingTablesFound.length,
    ticketingTablesExpected: TICKETING_TABLES.length,
    missingTicketingTables,
    venueSeatsSelfReferenceFkPresent: Boolean(selfRefFk),
    ticketingForeignKeyCount: fks.length,
    ticketingIndexCount: indexes.length,
    pass: missingTicketingTables.length === 0 && Boolean(selfRefFk),
  };
}

async function connectTo(dbName) {
  return mysql.createConnection({
    host: process.env.SCRATCH_MYSQL_HOST,
    port: Number(process.env.SCRATCH_MYSQL_PORT || 3306),
    user: process.env.SCRATCH_MYSQL_USER,
    password: process.env.SCRATCH_MYSQL_PASSWORD,
    database: dbName,
    multipleStatements: false,
  });
}

async function runFresh(reset) {
  const dbName = process.env.SCRATCH_MYSQL_DATABASE_FRESH;
  if (!dbName) {
    console.log("SKIPPED fresh: SCRATCH_MYSQL_DATABASE_FRESH is not set.");
    return null;
  }
  console.log(`\n=== FRESH INSTALL: schema/001 through schema/009 -> ${dbName} ===`);
  const conn = await connectTo(dbName);
  try {
    if (reset) await resetDatabase(conn, dbName);
    await runFiles(conn, FRESH_FILES, "fresh");
    const report = await inspect(conn, dbName);
    console.log("Fresh install report:", JSON.stringify(report, null, 2));
    return report;
  } finally {
    await conn.end();
  }
}

async function runMigration(reset) {
  const dbName = process.env.SCRATCH_MYSQL_DATABASE_MIGRATION;
  if (!dbName) {
    console.log("SKIPPED migration: SCRATCH_MYSQL_DATABASE_MIGRATION is not set.");
    return null;
  }
  console.log(`\n=== MIGRATION PATH: schema/001-008 (pre-ticketing) + migrations/0001 + migrations/0002 -> ${dbName} ===`);
  const conn = await connectTo(dbName);
  try {
    if (reset) await resetDatabase(conn, dbName);
    await runFiles(conn, PRE_TICKETING_FILES, "pre-existing schema");
    await runFiles(conn, MIGRATION_FILES, "migration");
    const report = await inspect(conn, dbName);
    console.log("Migration path report:", JSON.stringify(report, null, 2));
    return report;
  } finally {
    await conn.end();
  }
}

async function main() {
  const mode = process.argv[2] || "both";
  const reset = process.argv.includes("--reset");

  if (!process.env.SCRATCH_MYSQL_HOST || !process.env.SCRATCH_MYSQL_USER) {
    console.error(
      "Missing SCRATCH_MYSQL_HOST / SCRATCH_MYSQL_USER (and password/database vars). " +
        "See the comment block at the top of this file for how to create a scratch database " +
        "and where to set these."
    );
    process.exit(2);
  }

  const results = {};
  if (mode === "fresh" || mode === "both") results.fresh = await runFresh(reset);
  if (mode === "migration" || mode === "both") results.migration = await runMigration(reset);

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(results, null, 2));

  const ran = Object.values(results).filter(Boolean);
  const allPass = ran.length > 0 && ran.every((r) => r.pass);
  console.log(allPass ? "\nOVERALL: PASS" : "\nOVERALL: FAIL (or not run — check SKIPPED lines above)");
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
