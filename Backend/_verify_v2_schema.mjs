// Read-only verification only. Never logs MYSQL_USER/MYSQL_PASSWORD/JWT_SECRET/host or
// any connection URI — only the connected schema name and table/column metadata.
// Deleted after use, not part of the repo.
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, process.env.DOTENV_FILE || ".env.dev"), override: true });

const { initDB } = await import("./modules/db.module.js");

const EXPECTED_TABLES = [
  "users", "password_reset_tokens", "countries", "product_categories", "tcg_games",
  "esports_games", "news_categories", "products", "product_images", "inventory_movements",
  "deck_lists", "tournaments", "tournament_registrations", "tournament_teams",
  "tournament_team_members", "trade_listings", "news", "services", "enquiries",
].sort();

const LEGACY_TABLE_NAMES = [
  "PERSONAL_USER", "RESET_PASSWORD", "ACCOUNTS", "SHOP", "PRODUCTS", "MANAGE_INVENTORY",
  "CATEGORIES", "DISCOUNTS", "ORDERS", "CARTS", "WISHLISTS", "REVIEWS", "PAYMENTS", "DELIVERIES",
  "TRADE_LISTINGS", "TRADE_OFFERS", "CARD_GAMES", "SINGLES", "HISTORY_PURCHASE", "TOURNAMENT",
  "PARTICIPANTS", "POINT_SYSTEM", "PRIZES", "PRIZE_POINT", "NEWS", "DECKLIST", "CATEGORIES_TCG", "COUNTRIES",
];

try {
  const db = initDB();

  const [dbRows] = await db.query("SELECT DATABASE() AS db");
  const schemaName = dbRows[0].db;

  const [tableRows] = await db.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME"
  );
  const foundTables = tableRows.map((r) => r.TABLE_NAME);
  const foundSet = new Set(foundTables);

  const missing = EXPECTED_TABLES.filter((t) => !foundSet.has(t));
  const unexpected = foundTables.filter((t) => !EXPECTED_TABLES.includes(t));
  const legacyPresent = foundTables.filter((t) => LEGACY_TABLE_NAMES.includes(t));

  console.log("=== V2 SCHEMA VERIFICATION ===");
  console.log("Connected schema name:", schemaName);
  console.log("Tables found:", foundTables.length);
  console.log("Expected tables present:", EXPECTED_TABLES.length - missing.length, "/", EXPECTED_TABLES.length);
  console.log("Missing expected tables:", missing.length ? missing.join(", ") : "none");
  console.log("Unexpected/extra tables:", unexpected.length ? unexpected.join(", ") : "none");
  console.log("Legacy-named tables present in this schema:", legacyPresent.length ? legacyPresent.join(", ") : "none (good)");

  if (missing.length === 0) {
    const [colRows] = await db.query(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN ('users','tournaments','tournament_teams','tournament_team_members','products')
       ORDER BY TABLE_NAME, ORDINAL_POSITION`
    );
    console.log("\n--- Column spot-check ---");
    let currentTable = null;
    for (const c of colRows) {
      if (c.TABLE_NAME !== currentTable) {
        currentTable = c.TABLE_NAME;
        console.log(`\n${currentTable}:`);
      }
      console.log(`  ${c.COLUMN_NAME}: ${c.COLUMN_TYPE} ${c.IS_NULLABLE === "NO" ? "NOT NULL" : "NULL"}`);
    }
  }

  console.log("\n=== DONE ===");
  await db.end();
  process.exit(missing.length === 0 && legacyPresent.length === 0 ? 0 : 1);
} catch (err) {
  console.error("VERIFICATION FAILED:", err?.code || err?.message || err);
  process.exit(2);
}
