// Runs the app against a brand-new, throwaway database, for the browser tests
// (Playwright starts this; see playwright.config.ts) and the stress test.
//
//   node scripts/test-server.mjs [--prod] [--port 3100]
//
// Starts a local Postgres in .postgres-e2e (wiped first), applies the
// migrations, then runs `next dev` (or `next start` with --prod, after a
// build). Stops everything when stopped.
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { createRequire } from "node:module";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { loadEnv } from "./load-env.mjs";
import { startLocalPostgres } from "./local-postgres.mjs";

loadEnv();
const args = process.argv.slice(2);
const prod = args.includes("--prod");
const port = args.includes("--port") ? args[args.indexOf("--port") + 1] : "3100";
const pgPort = Number(process.env.TEST_PG_PORT ?? 5434);

// One folder per port, so a test server never wipes another's database.
const dataDir = `.postgres-e2e/${pgPort}`;
rmSync(dataDir, { recursive: true, force: true });
const pg = await startLocalPostgres({
  dir: dataDir,
  port: pgPort,
  persistent: false,
  databases: ["moneymoneymoney_test"],
  quiet: true,
});
const url = pg.url("moneymoneymoney_test");

const sql = postgres(url, { max: 1, onnotice: () => {} });
if (process.env.SECURITY_AUDIT) {
  // Supabase's API roles, so the audit can check the lockdown migration. As a
  // worst case, they're given access to every new schema and table by
  // default; the migration must take all of it away again.
  for (const role of ["anon", "authenticated", "service_role"]) {
    await sql.unsafe(`do $$ begin create role ${role} nologin; exception when duplicate_object then null; end $$`);
    await sql.unsafe(`alter default privileges grant all on tables to ${role}`);
    await sql.unsafe(`alter default privileges grant all on sequences to ${role}`);
    await sql.unsafe(`alter default privileges grant usage on schemas to ${role}`);
  }
}
await migrate(drizzle(sql), { migrationsFolder: "db/migrations" });
await sql.end();
console.log(`[test-server] database ready: ${url}`);

// Next's own CLI, run directly rather than through npx: with npx (and the
// shell it starts) in between, stopping this script left the server running.
const nextCli = createRequire(import.meta.url).resolve("next/dist/bin/next");
const next = spawn(process.execPath, [nextCli, prod ? "start" : "dev", "-p", port, "-H", "127.0.0.1"], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: url,
    // The browser tests create a fresh household each time; the security
    // audit (SECURITY_AUDIT=1) tests the real, closed sign-up instead.
    ...(process.env.SECURITY_AUDIT ? {} : { ALLOW_NEW_HOUSEHOLDS: "true", SIGNUP_LIMIT_PER_HOUR: "200" }),
    ...(prod ? { INSECURE_COOKIES: process.env.INSECURE_COOKIES ?? "1" } : {}),
  },
});

let stopping = false;
const stop = async (code = 0) => {
  if (stopping) return;
  stopping = true;
  next.kill("SIGTERM");
  await pg.stop().catch(() => {});
  process.exit(code);
};
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
next.on("exit", (code) => stop(code ?? 0));
