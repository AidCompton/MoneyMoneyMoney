# MoneyMoneyMoney

A local household money planner: savings goals, a monthly grocery budget,
and a weekly Money Meeting agenda — for the two of you, running entirely on
your own machine.

Nothing here talks to the internet at runtime. Data lives in a single
SQLite file on whichever computer you run it on. The only time this app
needs a network connection at all is the one-off `npm install` below.

## Running it

```bash
npm install       # fetches packages, and generates a local .env.local secret
npm run dev        # starts the app at http://localhost:3000
```

The database (`data/app.db`) and its tables are created automatically the
first time the app starts — there's no separate setup step.

For day-to-day use (rather than active development), run the production
build instead, which is faster and binds to your whole home network so you
can both reach it from your own devices:

```bash
npm run build
npm run start       # -> http://<this-machine's-LAN-IP>:3000
```

## First-time setup

1. One of you registers at `/register` under "New household" — this
   creates the household and shows a join code.
2. The other registers under "Join a household" with that code.
3. You're both now signed in separately, sharing the same goals, budget,
   and meeting history.

## Backing up your data

Since everything lives in one local file, back it up occasionally:

```bash
npm run db:backup   # copies data/app.db into data/backups/<timestamp>.db
```

## Testing

```bash
npm run test        # unit tests (Vitest) for the budget/goal math
npm run test:e2e    # a full browser smoke test (Playwright) of the core flows
```

## Stack

Next.js (App Router) + TypeScript, SQLite via Drizzle ORM, session auth via
encrypted cookies (iron-session), Tailwind CSS, and Recharts for the
savings goal chart. See the code under `app/`, `lib/`, and `db/` for the
route, business-logic, and schema layout.
