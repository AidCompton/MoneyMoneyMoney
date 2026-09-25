import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

const dataDir = path.join(/* turbopackIgnore: true */ process.cwd(), process.env.DATABASE_DIR ?? "data");
fs.mkdirSync(dataDir, { recursive: true });

const sqlite = new Database(path.join(dataDir, "app.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Apply any pending migrations automatically so the app runs with zero setup
// beyond `npm install` - there is no separate server to run `db:migrate` on.
migrate(db, { migrationsFolder: path.join(process.cwd(), "db/migrations") });
