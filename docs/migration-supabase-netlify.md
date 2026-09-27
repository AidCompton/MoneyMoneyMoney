# Moving to Supabase + Netlify

Status: **planned, not started.** Nothing here has been done to the code or to
any Supabase or Netlify account. Start only when asked.

Today the app runs on one computer at home: Next.js serving from that
machine, data in one SQLite file (`data/app.db`), receipt photos in
`data/receipts/`, and receipts read on that computer. The move puts the
database and photos in Supabase (Postgres + Storage) and the app on Netlify.

## What changes for you

- **Works anywhere**, not just on home Wi-Fi, and nothing needs to stay
  switched on at home. The iPhone home-screen app and the Back Tap shortcut
  point at the Netlify address instead.
- **Your data leaves the house.** Household finances and receipt photos will
  live on Supabase's servers. That's the opposite of the app's original "never
  touches the internet" design, so it's worth deciding deliberately.
- **The app is on the public internet.** Anyone could reach the sign-in page,
  so the security items below are part of the move, not extras.
- **Backups are your job on the free plan.** Supabase only backs up Pro, Team
  and Enterprise projects automatically (per its backup docs), and database
  backups never include stored files such as receipt photos.

## Decide before starting

1. **Which accounts.** The Supabase and Netlify accounts connected to Claude
   look like work ones: the Supabase organisation "Driver Bureau" (project
   "DB-CRM") and the Netlify team "DB Sales". Household money shouldn't live in
   a work CRM project or a work team. Recommended: a new personal Supabase
   project (or organisation) and a personal Netlify team.
2. **Region.** Pick the Supabase region closest to you. Check the current list
   when creating the project.
3. **Where receipts are read.** Recommended: **on the phone**. tesseract.js
   runs in the browser, with the language data served from the app itself, so
   no third-party service is involved. The alternative, a Netlify function, has
   to fit ~44 MB of recognition engine plus sharp inside a function's size and
   time limits. Check Netlify's current limits before choosing that route.
4. **Sign-in.** Recommended: keep the app's own sign-in (iron-session
   cookies). It works on Netlify as it is. Supabase Auth would add password
   resets and MFA, but it's a bigger change and can come later.

## Readiness: what has to change

Measured from the code as it stands.

| Area | Today | On Supabase + Netlify | Size |
| --- | --- | --- | --- |
| Database driver | better-sqlite3, synchronous: 146 `.get()/.all()/.run()` calls in 17 files, 11 transactions | postgres-js through the Supavisor **transaction pooler** (port 6543, `prepare: false`). Every query becomes `await`ed. | Largest |
| Schema | 21 `sqliteTable`s: `unixepoch()` timestamps, 0/1 booleans, `real` amounts, partial unique indexes | Port to `pgTable`: `timestamptz`, `boolean`, `double precision` (keeps today's rounding). Partial indexes carry over. | Medium |
| Migrations | Applied on startup (`db/index.ts`, `BEGIN IMMEDIATE`) | One fresh Postgres baseline from drizzle-kit, applied with `drizzle-kit migrate` over the direct or session connection at deploy time, not on each request | Small |
| Receipt photos | Files in `data/receipts/` | Private Supabase Storage bucket, served through the existing `/api/receipts/[id]/image` check | Small |
| Receipt reading | tesseract.js + sharp on the server | In the browser (see decision 3). The server still parses and saves. | Medium |
| Backups | SQLite backup API and download (Household page) | "Download everything": a JSON export of the household's rows and photos, which also keeps a way back to running at home | Small |
| Home-network features | LAN address and QR, `allowedDevOrigins`, and a join link built from the LAN IP | Drop the LAN card. The join link and QR use the site's public URL. | Small |
| Session cookie | `secure: false` (plain HTTP at home) | `secure: true` over HTTPS | Tiny |
| Tests | e2e tests against a local SQLite file | A local Postgres, or a Supabase branch, for e2e | Small |

## Security checklist for the public internet

- `SESSION_SECRET` only in Netlify environment variables, and a fresh one.
- **Rate-limit sign-in and join attempts.** There's none today. A 6-character
  join code and passwords can be guessed if there's no limit.
- **Close sign-ups** once both of you have joined. Today anyone who finds the
  site could create a household.
- **Turn on row level security** for every table (with no policies), or turn
  off Supabase's Data API. The app reaches Postgres only through Drizzle on
  the server, so nothing should be readable with the public API key.
- Keep the database password and service-role key server-only. Never send
  them to the browser.
- Keep the Storage bucket private.

## Steps, once you say go

1. Tag the current version (for example `local-v1`) so you can always go back
   to running at home.
2. Take a fresh backup (`npm run db:backup`) and copy `data/receipts/`.
3. Create the Supabase project and Netlify site in the chosen accounts.
   Collect `DATABASE_URL` (transaction pooler), the direct URL for
   migrations, and the Storage keys.
4. Port the schema and data layer to Postgres, and keep all tests passing
   against a local Postgres.
5. Move receipt photos to Storage and receipt reading to the phone.
6. Add rate limiting, closed sign-ups, secure cookies and RLS.
7. Write a one-off copy script: read `data/app.db`, insert each table into
   Supabase in foreign-key order (converting timestamps and 0/1 booleans), and
   upload the photos. Then check the row counts per table match exactly.
8. Deploy to Netlify, check that Netlify's adapter supports this Next.js
   version (16.3), and walk through every page on both phones.
9. Update the home-screen app and the Back Tap shortcut to the new address.
10. Keep the old `data/app.db` and photos until you're happy.

## Connection details (from Supabase's docs)

- Serverless code (Netlify functions) should use the **shared pooler in
  transaction mode**: `aws-[region].pooler.supabase.com:6543`. It doesn't
  support prepared statements, so use `postgres(url, { prepare: false })`.
- Migrations and `pg_dump` should use the **direct connection** (IPv6 on the
  free plan) or the **session pooler** (port 5432) from an IPv4-only network.
