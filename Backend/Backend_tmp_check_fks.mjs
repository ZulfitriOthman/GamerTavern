import dotenv from "dotenv"; import path from "path"; import mysql from "mysql2/promise";
dotenv.config({ path: path.join(process.cwd(), ".env.dev") });
const pool = mysql.createPool({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT||3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE });
const [rows] = await pool.query(`
  SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IN ('USERS','MERCHANTS')
`);
console.log(rows);
await pool.end();
