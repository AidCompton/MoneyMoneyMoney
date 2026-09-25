import { drizzle } from "drizzle-orm/better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

export const dataDir = path.join(/* turbopackIgnore: true */ process.cwd(), process.env.DATABASE_DIR ?? "data");
fs.mkdirSync(dataDir, { recursive: true });

export const sqlite = new Database(path.join(dataDir, "app.db"));
sqlite.pragma("journal_mode = WAL");
// Wait for another process (say, a parallel build worker) to finish writing.
sqlite.pragma("busy_timeout = 10000");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

const migrationsFolder = path.join(process.cwd(), "db/migrations");

/**
 * Applies pending migrations. This follows drizzle's own migrator, with two
 * differences:
 *
 * - Everything happens inside one `BEGIN IMMEDIATE` transaction. `next build`
 *   loads this file in several processes at once, and drizzle checks for
 *   pending migrations before taking a lock, so two processes could both try
 *   to apply the same one. Here the second waits for the first, then sees it
 *   is already applied.
 * - Each recorded migration is re-stamped with its journal timestamp,
 *   matched by content. Drizzle only applies migrations newer than the newest
 *   one recorded, and one journal entry was once written with a made-up
 *   future timestamp (since corrected), so a database that recorded it would
 *   otherwise skip every later migration.
 */
function migrateDatabase() {
  const migrations = readMigrationFiles({ migrationsFolder });
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    sqlite.exec(
      "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)",
    );
    const restamp = sqlite.prepare("UPDATE __drizzle_migrations SET created_at = ? WHERE hash = ? AND created_at <> ?");
    for (const m of migrations) restamp.run(m.folderMillis, m.hash, m.folderMillis);

    const last = sqlite.prepare("SELECT MAX(created_at) AS at FROM __drizzle_migrations").get() as {
      at: number | null;
    };
    const record = sqlite.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)");
    for (const m of migrations) {
      if (last.at !== null && Number(last.at) >= m.folderMillis) continue;
      for (const stmt of m.sql) if (stmt.trim()) sqlite.exec(stmt);
      record.run(m.hash, m.folderMillis);
    }
    sqlite.exec("COMMIT");
  } catch (e) {
    sqlite.exec("ROLLBACK");
    throw e;
  }
}

// Apply any pending migrations automatically so the app runs with zero setup
// beyond `npm install` - there is no separate server to run `db:migrate` on.
migrateDatabase();
