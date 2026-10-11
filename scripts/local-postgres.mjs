// A local PostgreSQL 17 (the same major version as Supabase) for development
// and tests, downloaded by npm as part of the dev dependencies. Nothing to
// install separately.
//
//   npm run db:local     starts it on port 5433 with its data in .postgres/
//                        (leave it running; Ctrl+C stops it)
//
// The matching connection string is in .env.local:
//   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/moneymoneymoney
import { execFileSync } from "node:child_process";
import { chownSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

/**
 * Starts a Postgres server. Returns { url(db), stop() }. When running as root
 * (as in some containers), Postgres refuses to start as root and runs as the
 * "postgres" user instead, which must own the data folder's parent.
 */
export async function startLocalPostgres({ dir, port, persistent = true, databases = [], quiet = false }) {
  const dataDir = path.resolve(dir);
  const fresh = !existsSync(path.join(dataDir, "PG_VERSION"));
  if (process.getuid?.() === 0) {
    mkdirSync(dataDir, { recursive: true });
    const uid = Number(execFileSync("id", ["-u", "postgres"]).toString());
    const gid = Number(execFileSync("id", ["-g", "postgres"]).toString());
    chownSync(dataDir, uid, gid);
  }

  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port,
    persistent,
    initdbFlags: ["--encoding=UTF8", "--locale=C.UTF-8"],
    onLog: quiet ? () => {} : (message) => process.stdout.write(`[postgres] ${message}`),
    onError: (message) => process.stderr.write(`[postgres] ${message}\n`),
  });
  if (fresh) await server.initialise();
  await server.start();

  const client = server.getPgClient();
  await client.connect();
  for (const name of databases) {
    const exists = await client.query("select 1 from pg_database where datname = $1", [name]);
    if (!exists.rowCount) await client.query(`create database "${name}"`);
  }
  await client.end();

  return {
    url: (database) => `postgres://postgres:postgres@127.0.0.1:${port}/${database}`,
    stop: () => server.stop(),
  };
}

// Run directly: the long-running development database.
if (import.meta.url === `file://${process.argv[1]}`) {
  const pg = await startLocalPostgres({
    dir: ".postgres",
    port: 5433,
    databases: ["moneymoneymoney"],
    quiet: true,
  });
  console.log(`Local Postgres is running: ${pg.url("moneymoneymoney")}`);
  console.log("Leave this running. Press Ctrl+C to stop it.");
  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
