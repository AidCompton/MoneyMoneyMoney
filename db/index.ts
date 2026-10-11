import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

// Two ways this app reaches Postgres:
//
// - On Cloudflare Workers, through the Hyperdrive binding, which keeps a pool
//   of connections next to the database. A Worker can't reuse a connection
//   from one request in another, so each request gets its own client
//   (cheap: Hyperdrive does the expensive connecting).
// - Everywhere else (`npm run dev`, tests, scripts), DATABASE_URL with one
//   shared pool for the whole process.
//
// Migrations are not applied here: run `npm run db:migrate` (see README.md).

const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

let processDb: DB | undefined;
const requestDbs = new WeakMap<object, DB>();

function connect(url: string, options: postgres.Options<Record<string, postgres.PostgresType>>): DB {
  return drizzle(postgres(url, { onnotice: () => {}, ...options }), { schema });
}

function currentDb(): DB {
  if (onWorkers) {
    const { env, ctx } = getCloudflareContext();
    let requestDb = requestDbs.get(ctx);
    if (!requestDb) {
      const url = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
      if (!url) throw new Error("No database configured: add the HYPERDRIVE binding (see docs/deploy.md).");
      requestDb = connect(url, {
        // Workers allow six open connections per request.
        max: 5,
        // Every column type here is built in, so skip the type lookup round trip.
        fetch_types: false,
        // Hyperdrive caches prepared statements; a plain DATABASE_URL to the
        // Supabase transaction pooler (port 6543) can't use them.
        prepare: !!env.HYPERDRIVE,
      });
      requestDbs.set(ctx, requestDb);
    }
    return requestDb;
  }

  if (!processDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set. For local development run `npm run db:local` (see README.md).");
    }
    processDb = connect(url, { max: 10, prepare: !url.includes(":6543") });
  }
  return processDb;
}

/**
 * The database. Use it like any Drizzle database (`db.select()...`); it
 * resolves to the right connection for wherever the code is running.
 */
export const db: DB = new Proxy({} as DB, {
  get(_target, property) {
    const real = currentDb();
    const value = Reflect.get(real, property, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

/** Anything that can run queries: the db itself or a transaction. */
export type Queryable = Pick<DB, "select" | "insert" | "update" | "delete">;
