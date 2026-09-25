# MoneyMoneyMoney

A household money companion for the two of you: shared and personal
budgets, income, savings accounts and goals, a grocery and meal-prep
planner, and a weekly Money Meeting agenda. It runs entirely on your own
machine.

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

1. One of you registers at `/register` under "New household". This
   creates the household; the join code is on the Household page.
2. The other registers under "Join a household" with that code.
3. You're both now signed in separately, sharing the same goals, budget,
   and meeting history.

Lost the code? It's always on the **Household** page (and on the overview
until the second person joins).

## How it's organised

The app has four spaces, switched from the top bar (or the bottom bar on a
phone):

- **Overview**: everything added up for the month. Your joint goal,
  income, spending (shared and both personal budgets), savings, what's
  left over, each of you at a glance, groceries and the latest meeting.
- **Shared**: money you manage together.
  - **Budget**: the month's shared budget across eight categories (Food &
    Toiletries, Cats, Gas, Fun activity, House, Miscellaneous, IOU, Gifts).
    Plan an amount per category, add expenses as they happen, and see the
    split as a donut chart.
  - **Groceries**: the month's shopping list, split into general items and
    meal preps.
  - **Goals** and **Meetings**: your joint savings goals and the weekly
    Money Meeting.
- **Personal**: each person's own money.
  - **Budget**: income, what you paid into the shared pot, spending in your
    own categories, and what's left over.
  - **Savings**: your savings accounts, with deposits and withdrawals.
  - You can view each other's personal pages, but only the owner can add or
    change anything there.
- **Household**: the join code for your partner, and **Lists** (below).

## Typing it once

Sub-categories, stores, personal categories, income sources, savings
sub-categories and groceries are typed the first time and then picked from
a dropdown after that. Names match regardless of capitals or extra spaces,
so "checkers" and "Checkers" are the same store.

To fix a typo, go to **Household → Lists** and rename it. Renaming an entry
to the name of one that already exists merges the two.

## Finding where the money went

Under each budget, **Where it went** lets you filter expenses by category,
sub-category, store and (for shared money) who added them. Each filter
shows only the options that still apply given the others. For example,
picking a store shows just the categories you've bought there. Filters live
in the URL, so a filtered view can be bookmarked.

## Personal money and the shared pot

"Paid into shared" is money moved from your own funds into the shared pot.
It isn't counted as personal spending, so the overview never counts the
same money twice. Your left-over is:

    income − personal spending − saved − paid into shared

A savings account's starting balance isn't counted as "saved" in the month
you added it. Only later deposits and withdrawals are.

## Groceries and meal preps

Each grocery line has a name, size, quantity, price (each) and comment.
Groceries you've bought before remember their last size and price. Meal
preps group the ingredients for a batch of dinners and show the cost per
dinner. Planning a meal you've prepped before copies its ingredients across.

Tick items off while shopping, then use **Log the shop** to add the till slip
total to the shared budget as a Food & Toiletries expense.

## Backing up your data

Everything lives in one file, `data/app.db`. On the **Household** page,
**Back up now** saves a copy to `data/backups/`, and **Download** saves one
to whatever device you're using. Keep a downloaded copy somewhere other
than the computer running the app. The same backup is available from the
terminal:

```bash
npm run db:backup
```

Backups use SQLite's own backup API, so they're safe while the app is
running and include your latest changes.

## Using it on your iPhones

The app runs on one computer at home. Your phones open it over your home
Wi-Fi and can be added to the home screen, where it opens full screen with
its own icon.

1. On the computer: `npm run build`, then `npm run start`. Leave it running.
2. Open **Household** on the computer. The **Use it on your phones** card
   shows this computer's address (something like `http://192.168.1.23:3000`)
   and a QR code.
3. On each iPhone, on the same Wi-Fi, point the Camera at the QR code (or
   type the address into Safari) and sign in.
4. Tap **Share → Add to Home Screen → Add**. The app appears as "Money".

After adding it to the home screen, open the app from there and sign in once
more: iOS keeps home-screen apps separate from Safari.

Things to know:

- The phones reach the app only while that computer is on, awake and running
  it, and only when they're on your home Wi-Fi.
- If the address stops working, the computer's network address has probably
  changed. Try the `.local` name shown on the Household page, or reserve a
  fixed address for the computer in your router's settings.
- The first time the phones connect, the computer may ask whether to allow
  incoming connections. Allow it.

## Testing

```bash
npm run test        # unit tests (Vitest): budget, flow and grocery maths, filters, dates, currency
npm run test:e2e    # browser tests (Playwright) of the shared, personal and grocery flows
```

## Stack

Next.js (App Router) + TypeScript, SQLite via Drizzle ORM, session auth via
encrypted cookies (iron-session), Tailwind CSS, GSAP for animation, and
Recharts for the savings goal chart. See the code under `app/`, `lib/`, and
`db/` for the route, business-logic, and schema layout.

## Design

A dark evergreen palette with mint and gold accents, frosted-glass panels
over a slowly drifting aurora. The type is Bricolage Grotesque for text and
numbers, with Instrument Serif italics as accents. Both fonts are stored in
`app/fonts/` (SIL Open Font License, see `app/fonts/OFL.txt`), so the app
never loads fonts from the internet.

Motion is in `components/motion/`: headings reveal line by line, panels
fade in as you scroll, amounts count up, and progress bars and rings fill
in. If your device has "reduce motion" turned on, everything appears
straight away with no animation.
