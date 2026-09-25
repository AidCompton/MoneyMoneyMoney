import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

export const dataDir = path.join(/* turbopackIgnore: true */ process.cwd(), process.env.DATABASE_DIR ?? "data");
fs.mkdirSync(dataDir, { recursive: true });

export const sqlite = new Database(path.join(dataDir, "app.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

const migrationsFolder = path.join(process.cwd(), "db/migrations");

/**
 * Drizzle only applies migrations newer than the newest one a database has
 * recorded. One journal entry was once written with a made-up future
 * timestamp (since corrected), so a database that recorded it would skip
 * every later migration. Re-stamp each recorded migration with its journal
 * timestamp, matched by content, before migrating.
 */
function repairMigrationTimestamps() {
  const recorded = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
    .get();
  if (!recorded) return;
  const restamp = sqlite.prepare(
    "UPDATE __drizzle_migrations SET created_at = ? WHERE hash = ? AND created_at <> ?",
  );
  for (const m of readMigrationFiles({ migrationsFolder })) {
    restamp.run(m.folderMillis, m.hash, m.folderMillis);
  }
}

// Apply any pending migrations automatically so the app runs with zero setup
// beyond `npm install` - there is no separate server to run `db:migrate` on.
repairMigrationTimestamps();
migrate(db, { migrationsFolder });
