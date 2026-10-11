# Stress test

October 2026, before the move online. The goals:

1. Find out whether the app stays correct under concurrent use, with no lost
   or doubled records.
2. Measure how it copes with far more data and traffic than a household
   will ever produce.
3. Measure how much processing each page needs, since that decides which
   Cloudflare plan works.

**Result:** no failed requests and no data errors in any scenario. Most
pages need 15 to 70 ms of processing each, so the app needs **Cloudflare's
Workers Paid plan**. The free plan allows 10 ms per request.

## Setup

**The machine:** a 4-core cloud container (Intel Xeon, 2.8 GHz) with 15 GB
of memory.

**The app:** a production build (`next start`, Next.js 16.3.8, Node 22),
running as one process.

**The database:** a local PostgreSQL 17 on the same machine.

**The data:** three years for one household, "The Stress Test", seeded by
`scripts/seed-stress.mjs`:

| | |
| --- | --- |
| Expenses | 4,000 (about 35% personal) over 36 months |
| Budgets | shared and personal plans for every month (648 lines) |
| Income and payments into the shared pot | every month for both people |
| Savings | 3 goals with 200 contributions; 3 accounts with 400 transactions |
| Groceries | 300 items, 108 meal preps, 1,980 list lines |
| Receipts | 200, each with a photo (55 KB) and 6 line items, plus 300 remembered lines |
| Meetings | 150, with 400 action items (about 120 still open) |
| Other households | 30, with 200 expenses each, so isolation is tested at scale (10,000 expenses in all) |

That's far more than a real household. Open action items in particular:
real ones get done or carried over.

To run it yourself:

```bash
TEST_PG_PORT=5437 node scripts/test-server.mjs --prod --port 3400   # after `npm run build`; leave running
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5437/moneymoneymoney_test node scripts/seed-stress.mjs
node scripts/stress-test.mjs --base http://127.0.0.1:3400 \
  --db postgres://postgres:postgres@127.0.0.1:5437/moneymoneymoney_test > results.json
```

The seed script refuses any database that isn't on this computer.

## Processing time per page

Measured one request at a time, with nothing else running. Each figure is
the server's own CPU time over 40 requests, divided by 40, after a short
pause so earlier work isn't counted. Waiting for the database isn't
included. Cloudflare doesn't count that either.

| Page | CPU per request |
| --- | ---: |
| Receipt photo | 7.5 ms |
| Sign-in page (signed out) | 15.8 ms |
| Goals | 19.5 ms |
| A receipt | 19.5 ms |
| Budget, filtered by one store | 26 ms |
| Personal page | 37.3 ms |
| Groceries | 38.8 ms |
| Lists | 40.3 ms |
| Budget, this month (62 expenses) | 43.3 ms |
| A goal | 44 ms |
| Meetings | 47.3 ms |
| Overview (dashboard) | 53.5 ms |
| A meeting (live snapshot of goals, budget and groceries) | 69.3 ms |
| Budget, a month with 361 expenses | 102.3 ms |
| Download everything (export) | 113.5 ms |
| A sign-in (password check, measured separately) | about 90 ms |

What stands out:

- **The password check is slow on purpose.** That's what makes guessing
  passwords expensive.
- **The budget page grows with the month.** It lists every expense in the
  month, so its cost grows with the count. A real month of 50 to 100 shared
  expenses sits near the 43 ms figure. If a month ever reached hundreds,
  paging the list would be the fix.
- **The meeting page adds up the most:** goals, the household overview,
  groceries and every open action item.

## Under load

autocannon sent as many requests as it could, signed in, for 15 seconds at
10 and then 50 connections at once. "Waits" are milliseconds from request to
response.

| Page | Connections | Requests/s | Median wait | 99th percentile | Failed |
| --- | ---: | ---: | ---: | ---: | ---: |
| Overview | 10 | 22 | 429 | 622 | 0 |
| | 50 | 23 | 2,062 | 2,520 | 0 |
| Budget | 10 | 24 | 361 | 1,732 | 0 |
| | 50 | 27 | 1,755 | 2,628 | 0 |
| Budget, filtered | 10 | 45 | 197 | 1,449 | 0 |
| | 50 | 45 | 1,052 | 1,532 | 0 |
| Personal page | 10 | 32 | 284 | 953 | 0 |
| | 50 | 35 | 1,367 | 2,002 | 0 |
| Groceries | 10 | 32 | 281 | 1,324 | 0 |
| | 50 | 33 | 1,452 | 2,027 | 0 |
| Lists | 10 | 26 | 351 | 1,121 | 0 |
| | 50 | 27 | 1,766 | 2,306 | 0 |
| A receipt | 10 | 87 | 99 | 649 | 0 |
| | 50 | 96 | 497 | 954 | 0 |
| Receipt photo | 10 | 283 | 33 | 59 | 0 |
| | 50 | 308 | 158 | 226 | 0 |
| Export | 10 | 11 | 909 | 1,172 | 0 |
| | 50 | 10 | 4,513 | 5,526 | 0 |

How to read this:

- At 50 connections, one Node process on one machine queues requests: the
  rate stays level and waits grow. Nothing failed or timed out.
- On Cloudflare there's no single process. Each request runs separately, so
  these queues don't form the same way.
- Two people use a few requests a minute at most, about a thousand times
  less than this.

## Concurrent writes

| Scenario | Result |
| --- | --- |
| 300 expenses from 20 connections at once, all naming the same brand-new store | 300 of 300 saved, and the store exists exactly once. Nothing failed. |
| 100 saves of the same month's budget plan from 25 connections at once | No category ever got two budget lines. Nothing failed. |
| 40 sign-ins from 10 connections at once | All 40 signed in, about 6 a second (the password check limits the rate). |

Both races depend on the database enforcing uniqueness, not on the app
checking first:

- "Find or create" for list entries such as stores uses `ON CONFLICT`
  against a unique index.
- A budget line is unique per household, person, month and category
  (`NULLS NOT DISTINCT`, so the shared budget counts too).

## What this means on Cloudflare

- **Workers Free would fail.** It stops a request after 10 ms of CPU, and
  nearly every page above needs more, as does a sign-in.
- **Workers Paid allows 30 seconds** of CPU per request by default.
- **The monthly allowance is far more than enough.** It includes 30 million
  CPU-milliseconds (Cloudflare's pricing page, October 2026). At about
  50 ms a page, that's around 600,000 page views a month. Two people might
  use a few thousand.

These figures come from this test machine, not Cloudflare. Cloudflare's
processors and runtime differ, so expect somewhat different numbers, though
the same order of size. After deploying, the Worker's **Metrics** page in the
Cloudflare dashboard shows real CPU time per request.

## Not covered

- **Cloudflare and Supabase themselves.** Their limits, latency from South
  Africa to London, and Hyperdrive's connection pooling weren't load-tested.
  That would mean sending heavy traffic to the real accounts.
- **Phones.** Reading a receipt happens on the phone, so it costs the server
  nothing. Its speed depends on the phone. In the browser tests, a receipt
  took a few seconds to read on this machine.
- **A single run.** Timings vary a little between runs. The correctness
  results (rows written, duplicates, failures) don't.
