// Applies pending database migrations (db/migrations) to DATABASE_URL.
//
//   DATABASE_URL=postgres://... npm run db:migrate
//
// For Supabase use the direct connection or the session pooler (port 5432),
// not the transaction pooler (6543). Safe to run repeatedly: applied
// migrations are recorded in drizzle.__drizzle_migrations and skipped.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { loadEnv } from "./load-env.mjs";

loadEnv();
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  // Two deploys at once can't apply the same migration twice.
  await sql`select pg_advisory_lock(7240117)`;
  await migrate(drizzle(sql), { migrationsFolder: "db/migrations" });
  const [{ n }] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
  console.log(`Database is up to date (${n} migrations applied).`);
} finally {
  await sql.end();
}
