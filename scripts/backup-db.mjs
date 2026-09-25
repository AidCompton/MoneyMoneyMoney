import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const dbPath = path.join(process.cwd(), "data", "app.db");
const backupDir = path.join(process.cwd(), "data", "backups");

if (!existsSync(dbPath)) {
  console.error(`No database found at ${dbPath} - nothing to back up.`);
  process.exit(1);
}

mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `app-${timestamp}.db`);
copyFileSync(dbPath, backupPath);

console.log(`Backed up database to ${backupPath}`);
