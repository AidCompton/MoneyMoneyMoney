// npm run db:backup: the same backup as the button on the Household page.
// Uses SQLite's backup API (not a file copy) so recent changes still in the
// write-ahead log are included, and it's safe while the app is running.
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dataDir = path.join(process.cwd(), process.env.DATABASE_DIR ?? "data");
const dbPath = path.join(dataDir, "app.db");
const backupDir = path.join(dataDir, "backups");

if (!existsSync(dbPath)) {
  console.error(`No database found at ${dbPath} - nothing to back up.`);
  process.exit(1);
}

mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `app-${timestamp}.db`);
const db = new Database(dbPath, { readonly: true });
await db.backup(backupPath);
db.close();

console.log(`Backed up database to ${backupPath}`);
