// Copies your household from the old home version of the app (a SQLite file,
// data/app.db, plus receipt photos in data/receipts) into Postgres (Supabase).
//
//   DATABASE_URL="postgres://..." npm run import:sqlite                 a dry run: checks everything, saves nothing
//   DATABASE_URL="postgres://..." npm run import:sqlite -- --commit     does the import
//
// Options: --db path/to/app.db (default data/app.db), --receipts path/to/folder
// (default data/receipts).
//
// Safe by design:
// - Your app.db is never changed: the script works on a copy.
// - An older app.db is first brought up to date with the old migrations.
// - Everything goes in one transaction, then the row count of every table is
//   compared with the original. Any difference and nothing is saved.
// - It refuses to run if the Postgres database already holds a household,
//   so it can't import twice.
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import postgres from "postgres";
import { describeDatabase } from "./db-target.mjs";
import { loadEnv } from "./load-env.mjs";

loadEnv();
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const commit = args.includes("--commit");
const dbPath = option("--db", "data/app.db");
const receiptsDir = option("--receipts", "data/receipts");
const url = process.env.DATABASE_URL;

const fail = (message) => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};
if (!url) fail("Set DATABASE_URL to your Supabase connection string (see docs/deploy.md, step 5, or docs/deploy-netlify.md, step 4).");
if (!existsSync(dbPath)) fail(`Can't find ${dbPath}. Run this from the app folder, or pass --db path/to/app.db.`);

let Database;
try {
  ({ default: Database } = await import("better-sqlite3"));
} catch {
  fail("better-sqlite3 isn't installed. Run `npm install` and try again.");
}

// Tables in the order they must be inserted (each only refers to earlier ones).
const TABLES = [
  "households",
  "users",
  "categories",
  "subcategories",
  "labels",
  "budget_lines",
  "receipts",
  "expenses",
  "receipt_items",
  "receipt_aliases",
  "incomes",
  "shared_contributions",
  "savings_goals",
  "goal_contributions",
  "savings_accounts",
  "savings_transactions",
  "grocery_items",
  "meal_preps",
  "grocery_list_items",
  "money_meetings",
  "action_items",
];

// --- 1. A private, up-to-date copy of the SQLite database --------------------

const work = mkdtempSync(path.join(os.tmpdir(), "mmm-import-"));
const copyPath = path.join(work, "app.db");
copyFileSync(dbPath, copyPath);
for (const suffix of ["-wal", "-shm"]) if (existsSync(dbPath + suffix)) copyFileSync(dbPath + suffix, copyPath + suffix);
const sqlite = new Database(copyPath);
sqlite.pragma("foreign_keys = ON");

function upgradeSqlite() {
  // The same logic the home version ran on startup.
  const folder = "scripts/sqlite-legacy/migrations";
  const journal = JSON.parse(readFileSync(path.join(folder, "meta/_journal.json"), "utf8"));
  const migrations = journal.entries.map((e) => {
    const text = readFileSync(path.join(folder, `${e.tag}.sql`), "utf8");
    return { when: e.when, hash: createHash("sha256").update(text).digest("hex"), sql: text.split("--> statement-breakpoint") };
  });
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    sqlite.exec(
      "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)",
    );
    const restamp = sqlite.prepare("UPDATE __drizzle_migrations SET created_at = ? WHERE hash = ? AND created_at <> ?");
    for (const m of migrations) restamp.run(m.when, m.hash, m.when);
    const last = sqlite.prepare("SELECT MAX(created_at) AS at FROM __drizzle_migrations").get().at;
    let applied = 0;
    for (const m of migrations) {
      if (last !== null && Number(last) >= m.when) continue;
      for (const statement of m.sql) if (statement.trim()) sqlite.exec(statement);
      sqlite.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)").run(m.hash, m.when);
      applied++;
    }
    sqlite.exec("COMMIT");
    if (applied) console.log(`Brought the copy of app.db up to date (${applied} old migration(s)).`);
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}
upgradeSqlite();

// --- 2. Connect to Postgres and check it's ready and empty -------------------

console.log(`${commit ? "Importing into" : "Checking against"} ${describeDatabase(url)}`);
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const sql = postgres(url, { max: 1, ssl: local ? false : "require", onnotice: () => {}, prepare: !url.includes(":6543") });

const finish = async (code) => {
  await sql.end({ timeout: 5 }).catch(() => {});
  sqlite.close();
  rmSync(work, { recursive: true, force: true });
  process.exit(code);
};

try {
  const [{ ready }] = await sql`select to_regclass('app.households') is not null as ready`;
  if (!ready) {
    console.error("\n✗ The Postgres database has no tables yet. Run `npm run db:migrate` first (docs/deploy.md).\n");
    await finish(1);
  }
  const [{ n: existing }] = await sql`select count(*)::int as n from app.households`;
  if (existing > 0) {
    console.error("\n✗ The Postgres database already has a household in it, so nothing was imported (to avoid doubles).\n");
    await finish(1);
  }

  // Column types in Postgres decide how each SQLite value is converted.
  const columnRows = await sql`
    select table_name, column_name, data_type from information_schema.columns where table_schema = 'app'`;
  const pgColumns = new Map();
  for (const c of columnRows) {
    if (!pgColumns.has(c.table_name)) pgColumns.set(c.table_name, new Map());
    pgColumns.get(c.table_name).set(c.column_name, c.data_type);
  }

  const convert = (value, type) => {
    if (value === null || value === undefined) return null;
    if (type === "timestamp with time zone") return new Date(Number(value) * 1000); // SQLite stored seconds
    if (type === "boolean") return Boolean(value);
    return value;
  };

  // --- 3. Copy everything in one transaction ---------------------------------

  const counts = [];
  await sql.begin(async (tx) => {
    for (const table of TABLES) {
      const target = pgColumns.get(table);
      const exists = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
      const rows = exists ? sqlite.prepare(`SELECT * FROM "${table}"`).all() : [];
      if (rows.length) {
        const columns = Object.keys(rows[0]).filter((c) => target.has(c));
        const converted = rows.map((row) => Object.fromEntries(columns.map((c) => [c, convert(row[c], target.get(c))])));
        for (let i = 0; i < converted.length; i += 500) {
          await tx`insert into ${tx("app." + table)} ${tx(converted.slice(i, i + 500), columns)}`;
        }
      }
      const [{ n }] = await tx`select count(*)::int as n from ${tx("app." + table)}`;
      counts.push({ table, sqlite: rows.length, postgres: n });
    }

    // Receipt photos.
    const withImages = sqlite.prepare("SELECT id FROM receipts WHERE has_image = 1").all();
    let photos = 0;
    const missing = [];
    for (const { id } of withImages) {
      const file = path.join(receiptsDir, `${id}.jpg`);
      if (!existsSync(file)) {
        missing.push(id);
        continue;
      }
      await tx`insert into app.receipt_images (receipt_id, content_type, data) values (${id}, 'image/jpeg', ${readFileSync(file)})`;
      photos++;
    }
    if (missing.length) {
      await tx`update app.receipts set has_image = false where id = any(${missing})`;
    }
    counts.push({ table: "receipt photos", sqlite: withImages.length, postgres: photos });

    console.log("\n" + "table".padEnd(24) + "home app".padStart(10) + "supabase".padStart(10));
    for (const c of counts) {
      const mark = c.sqlite === c.postgres ? " " : "✗";
      console.log(`${mark} ${c.table.padEnd(22)}${String(c.sqlite).padStart(10)}${String(c.postgres).padStart(10)}`);
    }
    if (missing.length) {
      console.log(`\n${missing.length} receipt photo(s) weren't in ${receiptsDir}; those receipts are imported without one.`);
    }

    const mismatched = counts.filter((c) => c.table !== "receipt photos" && c.sqlite !== c.postgres);
    if (mismatched.length) throw new Error(`Row counts differ for: ${mismatched.map((c) => c.table).join(", ")}`);
    if (!commit) throw Object.assign(new Error("dry run"), { dryRun: true });
  });

  const people = sqlite.prepare("SELECT name, email FROM users").all();
  console.log(`\n✓ Imported. ${people.map((p) => `${p.name} (${p.email})`).join(" and ")} can sign in with their usual passwords.`);
  console.log("  Your old app.db is untouched. Keep it until you're happy with the new app.\n");
  await finish(0);
} catch (error) {
  if (error.dryRun) {
    console.log("\nDry run finished: everything checks out, and nothing was saved.");
    console.log("Run it again with --commit to import:  npm run import:sqlite -- --commit\n");
    await finish(0);
  }
  console.error(`\n✗ Nothing was imported: ${error.message}\n`);
  await finish(1);
}
