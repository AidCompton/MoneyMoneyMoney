# Putting the app online (Supabase + Cloudflare)

The app runs on Cloudflare Workers, and the data lives in a Supabase Postgres
database. Cloudflare reaches the database through Hyperdrive. You both sign
in with the app's own accounts, as before, and receipts are read on the phone.

Prefer Netlify? See [deploy-netlify.md](deploy-netlify.md). It doesn't need a
paid plan, but pages will likely be a little slower from South Africa.

This is a one-time setup. Most steps happen in the Supabase and Cloudflare
dashboards or on your own computer, and each one says which.

> Checked against Cloudflare's and Supabase's documentation in October 2026.
> Dashboards and prices change, so if a screen looks different, the
> provider's own docs win.

## Before you start

- **Both accounts should be your personal ones** (aidcompton@gmail.com).
  Step 1 shows how to check. Household money shouldn't sit in a work
  organisation where colleagues can see it.
- **The Cloudflare plan: Workers Paid**, a minimum of US$5 a month per
  account according to Cloudflare's pricing page in October 2026. Check the
  page for the current price. The free plan stops any request that
  uses more than 10 ms of processing time. In the stress test, most pages
  used 15 to 70 ms, and the heaviest over 100 ms (see
  [stress-test.md](stress-test.md)). On the free plan, most pages would fail
  with "Worker exceeded resource limits". The paid plan allows 30 seconds
  by default.
- **Supabase's free plan is enough**, with three things to know:
  - free projects pause after a week of low use (see
    [Keeping it running](#keeping-it-running));
  - there are no automatic backups (see [Backups](#backups));
  - you can have two free projects at a time.
- **On your computer** you need Node.js. This was tested with Node 22, and
  20 or newer should work. If you use Windows, I believe the Cloudflare
  build tools (OpenNext) work best under WSL. Check OpenNext's docs if a
  build fails.
- **The new code.** Merge the pull request with these changes into `main`,
  then on your computer run:

  ```bash
  git checkout main
  git pull
  npm install
  ```

  Every step below runs from that folder.

## 1. Check you're in the right accounts

**Supabase**

1. Sign in at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Open your account menu (top right) and check that the email is
   aidcompton@gmail.com.
3. Create a personal organisation for this (for example "Compton
   household", Free plan). Don't use "Driver Bureau".

**Cloudflare**

On your computer, in the app folder, run:

```bash
npx wrangler login     # opens the browser: sign in as aidcompton@gmail.com
npx wrangler whoami    # must print aidcompton@gmail.com
```

If `whoami` shows another email, run `npx wrangler logout` and sign in again.

## 2. Create the Supabase project

In the personal organisation, choose **New project**:

- **Name:** `moneymoneymoney`.
- **Database password:** generate a strong one and save it in your password
  manager. You'll paste it into connection strings below.
- **Region:** **West EU (London)**, `eu-west-2`.
  - Supabase has no South African region. London is a sensible choice for
    South Africa.
  - **Don't pick `sa-east-1`.** That's São Paulo, Brazil, not South Africa.
  - The app's Cloudflare settings assume London: `placement.region` in
    `wrangler.jsonc` is `aws:eu-west-2`. If you pick another region, change
    that line to match.
- If the form offers to turn off the Data API, you can: the app doesn't use
  it. If not, that's fine too. The tables are locked away from it either way
  (see [security-audit.md](security-audit.md)).

Wait for the project to finish setting up.

## 3. Create the tables

1. In the project, click **Connect** (top bar).
2. Copy the **Session pooler** connection string and put your database
   password in place of `[YOUR-PASSWORD]`. It looks like
   `postgresql://postgres.<project-ref>:<password>@aws-0-eu-west-2.pooler.supabase.com:5432/postgres`.
3. On your computer, in the app folder, run:

   ```bash
   DATABASE_URL='<session pooler string>' npm run db:migrate
   ```

   In Windows PowerShell, set the variable first:

   ```powershell
   $env:DATABASE_URL='<session pooler string>'; npm run db:migrate
   ```

4. The script first prints **"Updating Supabase project `<ref>`"**. That ref
   is also in your browser's address bar on the Supabase dashboard
   (`supabase.com/dashboard/project/<ref>`), so you can confirm it's the
   right project.
5. It then prints **"Database is up to date (2 migrations applied)."** It's
   safe to run again. Migrations already applied are skipped.

In the dashboard, **Table Editor → schema `app`** now shows 23 tables. The
**Security Advisor** may report "RLS enabled, no policy" for them. That's
intended: it's what keeps the public API key from reading anything.

Use the session pooler (port 5432) here and in step 4, not the transaction
pooler (port 6543).

## 4. Create the Hyperdrive connection

Hyperdrive keeps database connections open near Supabase, so pages don't
pay for a new connection each time. On your computer:

```bash
npx wrangler hyperdrive create moneymoneymoney \
  --connection-string='<session pooler string>' \
  --caching-disabled
```

1. **Keep `--caching-disabled`.** With caching on, Hyperdrive can serve a
   saved answer for a minute or so after a change (60 seconds by default,
   per Cloudflare's docs). You'd see totals from
   before your last expense, and a signed-out device could keep working for
   that minute. If you create it in the dashboard instead (**Storage &
   databases → Hyperdrive**), turn caching off in its settings.
2. The command prints an `id`. In `wrangler.jsonc`, replace
   `REPLACE_WITH_HYPERDRIVE_ID` with it. The id isn't a secret: it's
   useless without access to your Cloudflare account. The database password
   stays inside Hyperdrive.
3. Commit and push that change:

   ```bash
   git commit -am "Set the Hyperdrive id"
   git push
   ```

   Automatic deploys (step 6) build from GitHub, so the id has to be there.

I couldn't open Cloudflare's Supabase-specific Hyperdrive guide from where
this was written, so here is my reasoning. The session pooler string works
from anywhere because it's IPv4. The direct connection (`db.<ref>.supabase.co`)
is IPv6-only on Supabase's free plan. If Cloudflare's guide recommends a
different string, it should also work, except the transaction pooler (port
6543): the app uses prepared statements through Hyperdrive, and Supabase
says that pooler doesn't support them.

## 5. Bring your data across

Skip this if you're starting fresh. The first person to sign up on the live
site creates the household, and sign-up then closes.

Do this before anyone signs up on the live site: the import refuses to run
once the database holds a household, so it can never import twice.

On the computer that runs the home version (where `data/app.db` is), with
the new code pulled and `npm install` run:

```bash
# A dry run: checks everything, saves nothing.
DATABASE_URL='<session pooler string>' npm run import:sqlite

# The import.
DATABASE_URL='<session pooler string>' npm run import:sqlite -- --commit
```

- It prints which Supabase project it's checking or importing into, then a
  table of row counts: home app vs Supabase.
- Everything is copied in one go, or nothing is.
- Your `app.db` is never changed.
- Receipt photos come from `data/receipts/`. Pass `--db` and `--receipts` if
  yours are elsewhere.

You'll both sign in with your usual passwords. Change them in step 7.

## 6. Put the app online

**From your computer** (simplest):

1. Upgrade to **Workers Paid** in the Cloudflare dashboard. It's in the
   plan settings under **Workers & Pages**; the exact place moves now and
   then.
2. Run:

   ```bash
   npx wrangler whoami                      # still aidcompton@gmail.com?
   npm run deploy                           # builds and uploads (a few minutes)
   npx wrangler secret put SESSION_SECRET   # paste a new random secret
   ```

3. For the secret, generate a fresh one, different from the one in your
   `.env.local`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

Until the secret is set, sign-in shows an error. Nothing is exposed in the
meantime.

**Or with automatic deploys from GitHub (Workers Builds):**

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a
   repository**.
2. Connect GitHub, pick `AidCompton/MoneyMoneyMoney`, and use branch `main`.
3. Settings:
   - Worker name: `moneymoneymoney`. It must match `name` in
     `wrangler.jsonc`, or the build fails.
   - Build command: `npx opennextjs-cloudflare build`.
   - Deploy command: `npx opennextjs-cloudflare deploy`.
4. Under the Worker's **Settings → Variables and secrets**, add
   `SESSION_SECRET` as a **Secret**.

After that, every push to `main` deploys.

The app's address is `https://moneymoneymoney.<your-subdomain>.workers.dev`.
`wrangler` prints it, and the dashboard shows it. You can add your own
domain later under the Worker's **Settings → Domains & Routes**.

## 7. Check the live site

1. Open the address and sign in (or create your household).
2. Visit `/register` while signed out (a private window). Only **Join a
   household** should be offered.
3. Check the security settings arrived:

   ```bash
   curl -sI https://<your address>/login
   ```

   Look for `content-security-policy`, `strict-transport-security`,
   `x-frame-options: DENY` and `x-content-type-options: nosniff`. In the
   browser's developer tools, the cookie should be `__Host-mmm_session`,
   marked Secure and HttpOnly.
4. On each phone, scan a receipt from **Quick add**. The first scan
   downloads the reading engine (about 7 MB), which the phone then keeps.
5. **Change both passwords**, on **Household → Account**. New passwords need
   at least 10 characters (see [security-audit.md](security-audit.md) for
   why this matters after the move).
6. Download a first backup from **Household → Data**.

## 8. Your phones

- **Home-screen app:**
  1. Delete the old icon, which points at your home computer.
  2. Open the new address in Safari, sign in, then **Share → Add to Home
     Screen**.
  3. Open it from the home screen and sign in once more. iOS keeps
     home-screen apps separate from Safari.
- **Back Tap:**
  1. In the Shortcuts app, edit **Add expense**.
  2. Change the URL to `https://<your address>/add` (or `/add?for=personal`).
  3. The **Household** page shows the address and a QR code for it.

## Keeping it running

### Updates

Pull the new code and run `npm install`. Then:

1. If the release adds a database migration, run `npm run db:migrate` with
   `DATABASE_URL` as in step 3. Running it when nothing is new does no harm.
2. Run `npm run deploy`, or push to `main` if you set up Workers Builds.

### Backups

Supabase's free plan doesn't take automatic backups.

- **Monthly, or before big changes:** **Household → Data → Download
  everything with photos**. You get one JSON file with every record of your
  household. There's no one-click restore from this file yet. It's a
  complete, readable copy that a script could load back.
- **A full database copy**, if you have Postgres's tools installed.
  `pg_dump` must be the same major version as your Supabase database, or
  newer. This copies your data and the record of which migrations have run:

  ```bash
  pg_dump '<session pooler string>' --schema=app --schema=drizzle --format=custom --file=moneymoneymoney.dump
  ```

### Pausing

Supabase pauses free projects that have little database activity over 7
days, and emails a warning first. Supabase says a few requests a day is
typically enough to stay awake, so using the app most days should do it.
There's no published exact threshold.

If the project does pause, the site shows errors until you click **Resume
project** in the Supabase dashboard. That's possible for 90 days. To rule
pausing out, upgrade the organisation to Supabase Pro.

### Forgotten password

The app sends no email, so there's no reset link. Reset it from Supabase's
**SQL Editor** instead:

```sql
update app.users
set password_hash = extensions.crypt('A-Temporary-Password-1', extensions.gen_salt('bf', 10)),
    session_version = session_version + 1
where email = lower('you@example.com');
```

1. Run it (it should report 1 row updated), then sign in with the temporary
   password.
2. Change the password on **Household → Account** straight away, because the
   temporary one stays in the SQL Editor's history.
3. Bumping `session_version` signs out every device that was signed in.

This relies on the `pgcrypto` extension, which Supabase installs in the
`extensions` schema. If `crypt` isn't found, enable **pgcrypto** under
**Database → Extensions**.

### Costs to watch

- **Workers Paid** includes a monthly allowance of requests and processing
  time. At the time of writing that's 10 million requests and 30 million
  CPU-milliseconds. Two people won't come close.
- Requests for static files (scripts, styles, the receipt engine) are free.
- Set a usage notification in the Cloudflare dashboard if you'd like a
  warning.
