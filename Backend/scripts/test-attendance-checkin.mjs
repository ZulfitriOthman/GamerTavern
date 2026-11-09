// Backend/scripts/test-attendance-checkin.mjs
//
// Repeatable integration test for the Attendent tournament check-in API
// (routes/api/attendance.routes.js + Database/migrations/0010).
//
// SAFETY: refuses to run unless MYSQL_HOST is a local address. It WRITES
// fixture rows (a tournament, 2 users, registrations, check-ins) — never
// point it at a shared or production database. Fixture rows are tagged
// with a unique per-run suffix and are left in place (never deleted) so
// you can inspect them; use a throwaway database.
//
// Usage (server must already be running with the SAME env file):
//   DOTENV_FILE=.env.attendent-test node server.js                         # terminal 1
//   DOTENV_FILE=.env.attendent-test node scripts/test-attendance-checkin.mjs  # terminal 2
// Optional: API_BASE_URL (default http://127.0.0.1:$PORT), CONCURRENCY (default 25).
import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

dotenv.config({ path: path.join(process.cwd(), process.env.DOTENV_FILE || ".env.attendent-test"), override: true });

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
if (!LOCAL_HOSTS.has(String(process.env.MYSQL_HOST))) {
  console.error(`Refusing to run: MYSQL_HOST must be a local test database, got "${process.env.MYSQL_HOST}".`);
  process.exit(2);
}

const API = (process.env.API_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3002}`).replace(/\/+$/, "");
const CONCURRENCY = Number(process.env.CONCURRENCY || 25);
const run = crypto.randomBytes(4).toString("hex");
const password = crypto.randomBytes(12).toString("base64url"); // never printed

const db = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function call(method, urlPath, token) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function login(email) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!body?.token) throw new Error(`login failed for ${email}: HTTP ${res.status}`);
  return body.token;
}

async function countCheckins(registrationId) {
  const [[row]] = await db.query(`SELECT COUNT(*) AS n FROM PHONE_TOURNAMENT_CHECKINS WHERE REGISTRATION_ID = ?`, [registrationId]);
  return Number(row.n);
}

try {
  // ---------- fixtures (local DB only) ----------
  const hash = await bcrypt.hash(password, 10);
  const [admin] = await db.query(
    `INSERT INTO USERS (ROLE, NAME, EMAIL, PASSWORD_HASH, STATUS) VALUES ('admin', ?, ?, ?, 'active')`,
    [`TEST_admin_${run}`, `test_admin_${run}@attendent.test`, hash]
  );
  const [player] = await db.query(
    `INSERT INTO USERS (ROLE, NAME, EMAIL, PASSWORD_HASH, STATUS) VALUES ('user', ?, ?, ?, 'active')`,
    [`TEST_player_${run}`, `test_player_${run}@attendent.test`, hash]
  );
  const [[game]] = await db.query(`SELECT ID FROM ESPORTS_GAMES ORDER BY ID LIMIT 1`);
  const [t] = await db.query(
    `INSERT INTO TOURNAMENTS (ESPORTS_GAME_ID, NAME, SLUG, REGISTRATION_TYPE, STATUS) VALUES (?, ?, ?, 'individual', 'closed')`,
    [game.ID, `TEST_checkin_${run}`, `test-checkin-${run}`]
  );
  const tid = t.insertId;
  const [r1] = await db.query(`INSERT INTO TOURNAMENT_REGISTRATIONS (TOURNAMENT_ID, USER_ID, NICKNAME) VALUES (?, ?, 'TEST_user_reg')`, [tid, player.insertId]);
  const [r2] = await db.query(`INSERT INTO TOURNAMENT_REGISTRATIONS (TOURNAMENT_ID, GUEST_NAME) VALUES (?, ?)`, [tid, `TEST_guest_${run}`]);
  console.log(`fixtures: run=${run} tournament=${tid} registrations=${r1.insertId},${r2.insertId} api=${API}\n`);

  const adminToken = await login(`test_admin_${run}@attendent.test`);
  const playerToken = await login(`test_player_${run}@attendent.test`);
  const url = (rid) => `/api/attendance/tournaments/${tid}/registrations/${rid}/check-in`;

  // ---------- unauthorized ----------
  let r = await call("POST", url(r1.insertId), null);
  check("no token is rejected", r.status === 401, `HTTP ${r.status} ${r.body?.code}`);
  r = await call("POST", url(r1.insertId), playerToken);
  check("non-admin account is rejected", r.status === 403 && r.body?.code === "ADMIN_REQUIRED", `HTTP ${r.status} ${r.body?.code}`);
  check("rejected attempts stored nothing", (await countCheckins(r1.insertId)) === 0);

  // ---------- invalid input ----------
  r = await call("POST", `/api/attendance/tournaments/${tid}/registrations/abc/check-in`, adminToken);
  check("invalid registration id -> 400", r.status === 400, `HTTP ${r.status} ${r.body?.code}`);

  // ---------- success + repeat ----------
  r = await call("POST", url(r1.insertId), adminToken);
  check("first check-in -> 201 Checked in", r.status === 201 && r.body?.data?.alreadyCheckedIn === false, `HTTP ${r.status} ${r.body?.message}`);
  const firstAt = r.body?.data?.checkIn?.checkedInAt;
  r = await call("POST", url(r1.insertId), adminToken);
  check(
    "repeat -> 200 Already checked in (original time)",
    r.status === 200 && r.body?.code === "ALREADY_CHECKED_IN" && r.body?.data?.checkIn?.checkedInAt === firstAt,
    `HTTP ${r.status} ${r.body?.message}`
  );
  check("user registration stored exactly once", (await countCheckins(r1.insertId)) === 1);

  // ---------- concurrent (simulates many devices at once) ----------
  const results = await Promise.all(Array.from({ length: CONCURRENCY }, () => call("POST", url(r2.insertId), adminToken)));
  const created = results.filter((x) => x.status === 201).length;
  const already = results.filter((x) => x.status === 200 && x.body?.code === "ALREADY_CHECKED_IN").length;
  const other = results.length - created - already;
  check(`${CONCURRENCY} concurrent submissions -> exactly one 201`, created === 1 && other === 0, `201=${created} 200=${already} other=${other}`);
  const stored = await countCheckins(r2.insertId);
  check("concurrent registration stored exactly once", stored === 1, `rows=${stored}`);

  // ---------- registration status kept in sync ----------
  const [statuses] = await db.query(`SELECT ID, STATUS FROM TOURNAMENT_REGISTRATIONS WHERE TOURNAMENT_ID = ? ORDER BY ID`, [tid]);
  check("registrations flipped to checked_in", statuses.every((s) => s.STATUS === "checked_in"), statuses.map((s) => `${s.ID}:${s.STATUS}`).join(" "));

  // ---------- DB-level guard, independent of the API ----------
  try {
    await db.query(`INSERT INTO PHONE_TOURNAMENT_CHECKINS (TOURNAMENT_ID, REGISTRATION_ID) VALUES (?, ?)`, [tid, r1.insertId]);
    check("UNIQUE(REGISTRATION_ID) rejects a direct duplicate insert", false, "insert succeeded");
  } catch (err) {
    check("UNIQUE(REGISTRATION_ID) rejects a direct duplicate insert", err.code === "ER_DUP_ENTRY", err.code);
  }

  const [[total]] = await db.query(`SELECT COUNT(*) AS n FROM PHONE_TOURNAMENT_CHECKINS WHERE TOURNAMENT_ID = ?`, [tid]);
  console.log(`\nPHONE_TOURNAMENT_CHECKINS rows for tournament ${tid}: ${total.n} (expected 2)`);
  check("final row count", Number(total.n) === 2);
} catch (err) {
  failures++;
  console.error("ERROR", err.message);
} finally {
  await db.end();
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
