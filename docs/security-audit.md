# Security audit

October 2026, before moving the app from a computer at home to the public
internet (Cloudflare Workers and Supabase). This covers the code in this
repository, including the automated attack suite in `e2e-security/`. It
doesn't cover the Cloudflare or Supabase accounts themselves. Those are set
up by hand (see [deploy.md](deploy.md)), so check them against the list at
the end.

**Result:** all 18 tests pass against a production build. They're attacks,
checks of each defence, and a check that receipt reading still works under
the security settings. The problems below were found in the home version and
fixed before the move. One was serious for an internet-facing app: password
hashes were sent to the browser.

Re-run the audit at any time with:

```bash
npm run test:security
```

It builds the app, starts it in production mode with production settings
(secure cookies, sign-up closed after the first household) on a throwaway
local Postgres, and then attacks it. It also creates Supabase's API roles in
that database, with access to everything by default, to show the database
migrations take that access away again.

## What was found and fixed

The severity ratings are my judgement for an app on the public internet.
At home, on your own Wi-Fi, most of these were much less likely to matter.

| # | Problem in the home version | Severity | Fix | Checked by test |
| --- | --- | --- | --- | --- |
| 1 | **Password hashes were sent to the browser.** The meetings page passed whole user rows, including each person's bcrypt password hash, to the form for assigning action items. Anyone signed in to the household could read both hashes from the page source. | High | Members are now loaded without the hash, related users are limited to id and name, and the meetings page passes only id and name. | 13 |
| 2 | **No limit on guessing.** Passwords, join codes and sign-ups could be tried as fast as the server answered. | High | Attempts are counted in the database. Sign-in allows 8 failures per email and 30 per address every 15 minutes, checked before the password. Joining and creating a household allow 10 attempts per address per hour. Changing your password allows 8 wrong current passwords per 15 minutes. | 6, 7 |
| 3 | **Anyone could create a household.** | High | Sign-up closes once the first household exists (`ALLOW_NEW_HOUSEHOLDS` reopens it), and a household holds at most two people (`MAX_HOUSEHOLD_MEMBERS`). A third person can't join even with the right code. | 1, 8 |
| 4 | **Guessable join codes.** Six characters from `Math.random`. | Medium | Eight characters from the cryptographic random generator, plus the limit above. | 7 |
| 5 | **Sign-ins couldn't be revoked.** A copied cookie worked for its full 30 days, even after a password change. | Medium | Each user has a session version stored in the database and checked on every request. **Sign out other devices** and **Change password** (both new, on the Household page) bump it, which signs out every other device. | 16 |
| 6 | **Unknown emails answered faster.** That showed which emails had accounts. | Low | Unknown emails now go through the same slow password check. | 6 |
| 7 | **Cookie not marked secure.** Needed at home over plain HTTP. | Medium on the internet | The cookie is `__Host-mmm_session`: Secure, HttpOnly, SameSite=Lax, limited to this exact site. | 2 |
| 8 | **Unchecked form values.** Some forms accepted impossible dates, unlimited text and absurd amounts. An action item could be assigned to a person in another household. | Low | Dates must be real and between 1990 and 2100. Amounts must be at most R1,000,000,000. Text is capped at 200 characters (meeting notes at 20,000). IDs must be well-formed. Assignees must be in your household. | 10, 15 |
| 9 | **Next.js 16.3.6** had published advisories (`npm audit`). | Medium | Upgraded to 16.3.8. `npm audit --omit=dev` reports no known vulnerabilities. | — |
| 10 | **Receipt photos were decoded on the server** (sharp and Tesseract). Untrusted images were parsed server-side. | Low | Receipts are now read on the phone. The server accepts only a JPEG (checked by its first bytes) of at most 750 KB, and stores it as is. | — |

Found along the way (bugs, not security problems):

- The other partner couldn't delete a transaction on a joint savings
  account. They now can.
- The audit's own security settings broke receipt reading. The reader is
  WebAssembly, and a Content Security Policy without `'wasm-unsafe-eval'`
  stops browsers from compiling it, so a photo was never read. That worked
  on Cloudflare only by luck, because static files there are served without
  the policy. The policy now allows compiling WebAssembly (JavaScript `eval`
  is still blocked), and test 18 checks that a receipt is read.
- New in the move, caught before use: the migration script
  (`npm run db:migrate`) connected without TLS, so it would have reached
  Supabase unencrypted. It, the import script and any direct (non-Hyperdrive)
  connection now require TLS for databases that aren't on your own
  computer. Both scripts also print which Supabase project they're about to
  change, so you can check it's the right one before anything is written.

## Defences in place

**Sign-in**

- The app has its own sign-in. Passwords need at least 10 characters (at
  most 128) and are stored as bcrypt hashes (cost 10).
- A failed sign-in gives the same message, and takes about as long, whether
  or not the email exists.
- Joining says "That email is already registered" only after a valid join
  code is accepted for a household that still has room. Once you're both in,
  nobody can get that far.
- The rate limits above are stored in Postgres, so they hold across every
  copy of the Worker.

**Sessions**

- The cookie is encrypted and signed with `SESSION_SECRET` (iron-session).
  It's `__Host-`, Secure, HttpOnly and SameSite=Lax.
- Sign-ins last 30 days and can be revoked (see 5 above).
- A tampered cookie counts as signed out.

**Households can't see each other**

- Every page, API route and server action works only within the signed-in
  person's household. There are 44 server actions: 6 for signing in and
  out, plus 38 others, each checked to require a signed-in session.
- Records named in a form (a goal, meeting, account, list entry or meal
  prep) are looked up together with the household. A record from another
  household is "not found".
- Only the owner can change a personal budget or personal savings account.
  Joint accounts belong to the household.
- The tests try this with edited forms and replayed requests.

**Forged requests**

- Next.js refuses server actions whose `Origin` doesn't match the site.
- The cookie isn't sent on cross-site posts (SameSite=Lax).

**Browser**

- A Content Security Policy allows scripts, styles, images, fonts and
  connections only from the site itself, and no framing (`frame-ancestors
  'none'`, `X-Frame-Options: DENY`). It also allows compiling WebAssembly,
  for the receipt reader.
- Also set: HSTS, `nosniff`, `Referrer-Policy: same-origin`, a
  Permissions-Policy, and cross-origin opener and resource policies.
- No `X-Powered-By` header.

**Database**

- The tables live in their own `app` schema, which Supabase's automatic
  Data API doesn't publish.
- On top of that, every table has row level security turned on with no
  policies, and the `anon`, `authenticated` and `service_role` roles have no
  access to the schema at all. So even the public "anon" key can read
  nothing.
- All queries go through Drizzle with parameters, never string-built SQL.

**Receipts**

- Photos are served only to the household that owns them, as `image/jpeg`
  with `nosniff` and `Cache-Control: private`.
- Receipt text is read on the phone with tesseract.js, loaded from the app
  itself (`/ocr`), not a third-party CDN.

**Secrets**

- `SESSION_SECRET` is a Cloudflare secret, never in the repository.
- The database password lives only inside the Hyperdrive configuration.
- `.env.local` and `.dev.vars` are git-ignored.
- The audit checks that no page, page-data payload or export ever contains a
  password hash or the session secret.

**Your data**

- **Household → Data** downloads everything your household has, as JSON,
  optionally with receipt photos. It contains no password hashes and no join
  code.

## The attack tests

`e2e-security/security.spec.ts` runs these in order against one production
server.

1. The first household can be created. Then sign-up closes, and replaying
   the sign-up request is refused.
2. The session cookie is `__Host-`, Secure, HttpOnly and SameSite=Lax.
3. Security headers are on pages, signed-in pages and static files.
4. *(Setup)* The partner joins household A, and a second household B is
   created with data of its own.
5. Signed-out visitors are sent to sign-in from every page. The export
   answers 401, and receipt photos 404.
6. Eight wrong passwords lock an email out, from any address. An unknown
   email takes as long as a real one.
7. Guessing join codes gets locked out after ten tries, even when the
   eleventh is right.
8. A full household can't be joined, even with the right code.
9. Household B gets a 404 for every page, photo and export record of
   household A, and nothing of A's appears in B's pages.
10. Forms edited in the browser can't reach A's records:
    - contribute to A's goal;
    - add an action item to A's meeting, or assign one to A's people;
    - overwrite A's meeting notes;
    - deposit into A's savings account;
    - rename A's store;
    - add a grocery to A's meal prep.

    The test then checks the database to confirm nothing of A's changed.
11. Replaying a delete with A's expense ID deletes nothing. The same replay
    with B's own ID goes through, which shows the replay itself was valid.
12. A request forged from another site is refused. The same request from the
    site itself is accepted.
13. No page, page-data payload or export contains a bcrypt hash, a
    `password_hash` field or the session secret.
14. HTML and script typed into notes and store names is shown as text and
    never runs.
15. Absurd amounts, impossible dates and 5,000-character notes are refused
    or trimmed.
16. **Sign out other devices** works. Changing the password signs out other
    devices and the old password stops working. An edited cookie counts as
    signed out.
17. Every table has row level security, and Supabase's API roles have no
    access to the schema or any table.
18. A receipt photo is read in the browser under the production security
    settings, with no policy errors.

## What's left

These are known and accepted for now, roughly in order of importance.

1. **Change both passwords after the move.** The old version sent password
   hashes to the household's own browsers (problem 1). It also allowed
   8-character passwords, which the import brings across as they are. On
   the Household page, **Change password** needs at least 10 characters.
2. **No password reset by email.** The app sends no email. If one of you
   forgets a password, reset it in Supabase's SQL editor (see
   [deploy.md](deploy.md#forgotten-password)).
3. **Keep Hyperdrive's query caching off.** With caching on, a revoked
   sign-in could keep working until the cached answer expires, and totals
   could lag behind changes.
4. **The app's database login.** The live Netlify deployment connects as
   `moneymoney_app`. That role can read and write the app's tables but
   can't create, alter, empty or drop them, and can't touch the migration
   records. A leaked connection string can't destroy the schema. It has
   `bypassrls` because the tables' row level security has no policies (see
   [deploy-netlify.md, step 3b](deploy-netlify.md#3b-a-database-login-just-for-the-app-recommended)).
   The Cloudflare route still uses `postgres` through Hyperdrive unless you
   create the same role.
5. **Scripts are allowed inline** (`'unsafe-inline'`), because Next.js
   delivers page data in inline scripts. A per-request nonce would be
   stricter. For now, React escapes everything it renders, and test 14 checks
   that.
6. **No two-factor sign-in.** The rate limits and 10-character minimum make
   guessing slow, not impossible. Use passwords you don't use anywhere else.
7. **Sign-ins last 30 days**, with no sign-out after inactivity. Use **Sign
   out other devices** if a phone is lost.
8. **Cost of a flood of requests.** Cloudflare filters large attacks, but
   requests that reach the app count towards your plan. Per Cloudflare's
   pricing page in October 2026, Workers Paid includes 10 million requests
   and 30 million CPU-milliseconds a month. After that it charges $0.30 per
   extra million requests and $0.02 per extra million CPU-milliseconds. A
   flood big enough to cost real money would need millions of requests.
   Consider a usage notification in the Cloudflare dashboard.
9. **Backups are yours to take.** Supabase's free plan doesn't back up
   automatically (see [deploy.md](deploy.md#backups)).
10. **The per-address limits trust exactly one header, chosen by host:**
    `cf-connecting-ip` on Cloudflare, `x-nf-client-connection-ip` on
    Netlify (`lib/platform.ts`). Any other copy a visitor sends is ignored.
    Tested on Netlify's local emulation: 31 sign-ins with 31 faked
    addresses still counted as one address. Self-hosted, the fallback
    (`x-forwarded-for`) could be faked. The per-email limit doesn't depend
    on the address at all.
11. **This audit ran against a local production build.** After deploying,
    check the live site's cookie and headers as described in
    [deploy.md](deploy.md#7-check-the-live-site). The attack suite edits the
    database directly, so don't run it against the real one.

## Dependencies

- `npm audit --omit=dev`: no known vulnerabilities in what ships to
  Cloudflare (checked 11 October 2026; new advisories appear all the time, so
  re-check).
- `npm audit` including development tools reports 12 advisories (5 rated
  high, 7 moderate). They all trace back to three packages, used only by
  development tools that never reach the deployed app:
  - `braces` (high), through ESLint's dependencies;
  - `uuid` (moderate), through autocannon, the load-testing tool;
  - `esbuild` (moderate), through drizzle-kit, which generates migrations.

  They matter only on the machine running those tools.
