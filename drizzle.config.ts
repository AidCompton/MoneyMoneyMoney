import { defineConfig } from "drizzle-kit";

// `npm run db:generate` writes a new migration after a schema change (no
// database needed). `npm run db:migrate` applies pending migrations to the
// database in DATABASE_URL, which for Supabase should be the direct or
// session-pooler connection string (not the transaction pooler).
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  schemaFilter: ["app"],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5433/moneymoneymoney",
  },
});
