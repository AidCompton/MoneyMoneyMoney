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

rmSync(".postgres-e2e", { recursive: true, force: true });
const pg = await startLocalPostgres({
  dir: ".postgres-e2e",
  port: pgPort,
  persistent: false,
  databases: ["moneymoneymoney_test"],
  quiet: true,
});
const url = pg.url("moneymoneymoney_test");

const sql = postgres(url, { max: 1, onnotice: () => {} });
await migrate(drizzle(sql), { migrationsFolder: "db/migrations" });
await sql.end();
console.log(`[test-server] database ready: ${url}`);

const next = spawn("npx", ["next", prod ? "start" : "dev", "-p", port, "-H", "127.0.0.1"], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: url,
    // Tests create a fresh household each time.
    ALLOW_NEW_HOUSEHOLDS: "true",
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
