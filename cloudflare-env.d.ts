// Bindings and variables the Worker gets from wrangler.jsonc and the
// Cloudflare dashboard (see docs/deploy.md).
interface CloudflareEnv {
  /** Hyperdrive in front of the Supabase database (query caching disabled). */
  HYPERDRIVE?: { connectionString: string };
  /** Fallback when there's no Hyperdrive binding: a Postgres connection string. */
  DATABASE_URL?: string;
  /** Static files (pages, scripts, the receipt-reading engine). */
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
}
