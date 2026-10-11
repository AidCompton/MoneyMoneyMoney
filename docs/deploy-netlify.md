# Putting the app online with Netlify (+ Supabase)

The alternative to [Cloudflare](deploy.md). The app runs as Netlify
Functions, and the data lives in a Supabase Postgres database. Sign-in and
reading receipts on the phone work exactly as on Cloudflare.

**Why Netlify works without a paid plan:** Netlify Functions run on AWS
Lambda, which has no 10 ms processing limit. Each request may run for up
to 60 seconds.

> Tested by building with Netlify's own tools (`netlify build`, Next.js
> runtime v5.16.2) and running the result with `netlify serve` against a
> local Postgres. These worked:
> - signing in, with a secure `__Host-` cookie;
> - adding an expense;
> - reading and saving a receipt in the browser;
> - every security header, on pages and static files;
> - the sign-in rate limit, which held when the visitor's address was faked.
>
> It hasn't run on Netlify's real servers yet. Checked against Netlify's
> documentation in October 2026; if a screen looks different, Netlify's
> docs win.

## Before you start

- **Both accounts should be your personal ones** (aidcompton@gmail.com), not
  a work team. Step 1 shows how to check.
- **Which plan decides where the database goes:**
  - **Netlify free plan:** functions run in **Ohio, USA** (`us-east-2`), and
    you can't move them. Put the Supabase project in **East US (Ohio)**,
    `us-east-2`, next to them. Each page makes several database queries in a
    row, so the database must be close to the functions. Then there's one
    long trip per page (South Africa to Ohio and back), not one per query.
  - **Netlify Pro:** you can move the functions to London (**Cloud compute →
    Functions → Region → `lhr`**), so put Supabase in **West EU (London)**,
    `eu-west-2`, as in the Cloudflare guide. London is closer to South
    Africa than Ohio.
  - I haven't measured these delays. Expect pages to feel a little slower
    from South Africa than on Cloudflare, which runs near the database and
    starts close to you.
- **Cost:** Netlify's plans are credit-based. Two people's use should be
  small, but I'm not certain what the free plan includes now, so check
  Netlify's pricing page. Supabase's free plan is enough, with the caveats
  in [deploy.md](deploy.md#keeping-it-running): pausing, and no automatic
  backups.
- **The new code.** Merge the pull request into `main`, then on your
  computer run:

  ```bash
  git checkout main
  git pull
  npm install
  ```

## 1. Check you're in the right accounts

- **Supabase:** at [supabase.com/dashboard](https://supabase.com/dashboard),
  the account menu (top right) should show aidcompton@gmail.com. Create a
  personal organisation for this. Don't use "Driver Bureau".
- **Netlify:** at [app.netlify.com](https://app.netlify.com), your avatar
  (top right) → **User settings** should show aidcompton@gmail.com. Use your
  personal team, not a work one.

## 2. Create the Supabase project

As in [deploy.md, step 2](deploy.md#2-create-the-supabase-project), with
one difference: the region. Use **East US (Ohio)** on Netlify's free plan,
or **West EU (London)** if you'll set Netlify's function region to London.

Don't pick `sa-east-1`. That's São Paulo, Brazil, not South Africa.

## 3. Create the tables

Exactly as in [deploy.md, step 3](deploy.md#3-create-the-tables): use the
**Session pooler** string with `npm run db:migrate`. It prints the Supabase
project it's updating, so check that ref against your dashboard's address.

## 4. Bring your data across (optional)

Exactly as in [deploy.md, step 5](deploy.md#5-bring-your-data-across).

## 5. Create the Netlify site

1. In Netlify, choose **Add new project → Import an existing project →
   GitHub**, and pick `AidCompton/MoneyMoneyMoney`.
2. Build settings come from `netlify.toml` (build command
   `HOSTED_ON=netlify npm run build`, publish directory `.next`). Leave them
   as they are.
3. **Before the first deploy**, add the environment variables under
   **Project configuration → Environment variables**. Give each one every
   scope, or at least **Functions** and **Builds**.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase's **Transaction pooler** string (port **6543**), with your password filled in. Serverless functions should use this one. The app turns off prepared statements for it automatically, and connects over TLS. |
| `SESSION_SECRET` | A new random secret. Mark it **secret** if Netlify offers the option. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. |

4. Deploy.

Notes:

- `netlify.toml` can't hold these values. Netlify's functions don't read
  that file when they run.
- Changing a variable only takes effect after the next deploy.
- Pushing to `main` deploys automatically from then on.

**If you're on Netlify Pro**, set **Cloud compute → Functions → Region** to
London (`lhr`) and redeploy.

The address is `https://<name>.netlify.app`. You can rename it under **Site
configuration**, or add your own domain.

## 6. Check the live site

Same as [deploy.md, step 7](deploy.md#7-check-the-live-site), with your
Netlify address. In short:

1. Sign in.
2. While signed out, `/register` offers only **Join**.
3. `curl -sI https://<name>.netlify.app/login` shows
   `content-security-policy` and `strict-transport-security`.
4. Scan a receipt on each phone.
5. Change both passwords.
6. Download a first backup.

Also check that the sign-in rate limit sees real addresses:

1. In a private window, fail to sign in once with a made-up email.
2. In Supabase's **SQL Editor**, run:

   ```sql
   select key from app.auth_throttle where key like 'login-ip:%';
   ```

It should show your real IP address. If it shows `login-ip:unknown`, tell
me. That means Netlify didn't pass the `x-nf-client-connection-ip` header
the app relies on, and the per-address limit would be shared by everyone.
The per-email limit still works either way.

## 7. Your phones

As in [deploy.md, step 8](deploy.md#8-your-phones), using the Netlify
address for the home-screen app and the Back Tap URL (`…/add`).

## Keeping it running

[deploy.md](deploy.md#keeping-it-running) covers backups, Supabase pausing,
forgotten passwords and updates. On Netlify, updating means:

1. If a release adds a database migration, run `npm run db:migrate` (step 3).
2. Push to `main`, and Netlify rebuilds.
