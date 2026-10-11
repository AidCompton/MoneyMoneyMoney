import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { onNetlify, onWorkers } from "@/lib/platform";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

// Two ways this app reaches Postgres:
//
// - On Cloudflare Workers, through the Hyperdrive binding, which keeps a pool
//   of connections next to the database. A Worker can't reuse a connection
//   from one request in another, so each request gets its own client
//   (cheap: Hyperdrive does the expensive connecting).
// - Everywhere else (Netlify, `npm run dev`, tests), DATABASE_URL with one
//   pool per process. On Netlify that's Supabase's transaction pooler
//   (port 6543), which can't use prepared statements.
//
// Migrations are not applied here: run `npm run db:migrate` (see README.md).


let processDb: DB | undefined;
const requestDbs = new WeakMap<object, DB>();

function connect(url: string, options: postgres.Options<Record<string, postgres.PostgresType>>): DB {
  return drizzle(postgres(url, { onnotice: () => {}, ...options }), { schema });
}

/** A database on another machine is reached over TLS. */
function tlsFor(url: string) {
  return /@(localhost|127\.0\.0\.1)[:/]/.test(url) ? false : ("require" as const);
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
        // Hyperdrive itself handles TLS to the database.
        ssl: env.HYPERDRIVE ? false : tlsFor(url),
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
    processDb = connect(url, {
      // On Netlify every serverless instance has its own pool, all sharing
      // Supabase's pooler, so each keeps few connections and lets idle
      // ones go (an instance can be frozen between requests).
      ...(onNetlify ? { max: 3, idle_timeout: 20, connect_timeout: 10 } : { max: 10 }),
      prepare: !url.includes(":6543"),
      ssl: tlsFor(url),
    });
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
