# MoneyMoneyMoney

A household money companion for the two of you. It has:

- shared and personal budgets;
- income;
- savings accounts and goals;
- a grocery and meal-prep planner;
- a weekly Money Meeting agenda.

It runs online, on Cloudflare Workers or Netlify, with a Supabase (Postgres)
database, so it works from your phones anywhere. You each sign in with the app's own
accounts, and receipts are read on the phone itself.

- **Putting it online, step by step:** [docs/deploy.md](docs/deploy.md)
  (Cloudflare), or [docs/deploy-netlify.md](docs/deploy-netlify.md) (Netlify)
- **How it was secured and attacked:** [docs/security-audit.md](docs/security-audit.md)
- **How it held up under load:** [docs/stress-test.md](docs/stress-test.md)

## Running it on your computer

For trying changes before they go live:

```bash
npm install        # fetches packages and creates .env.local (a local secret and database address)
npm run db:local   # starts a local Postgres on port 5433; leave it running
```

Then in a second terminal:

```bash
npm run db:migrate   # creates the tables (safe to repeat)
npm run dev          # http://localhost:3000
```

The local Postgres comes with the dev packages, so there's nothing else to
install. Its data lives in `.postgres/`.

To try the Cloudflare version itself on your computer, run
`npm run preview`. It uses the same local database.

If you forget `npm install` after pulling a new version, the app says so
rather than failing with "Module not found".

## First-time setup

1. One of you registers at `/register` under **New household**.
2. The other joins with the **join link** or QR code on the Household page,
   which opens sign-up with the code filled in. You can also choose **Join a
   household** and type the code.
3. You're now signed in separately, sharing the same goals, budget and
   meeting history.

Once the first household exists, sign-up closes. A household holds two
people, so nobody else can join even with the code. Coming from the home
version? Bring your data across instead: [docs/deploy.md](docs/deploy.md),
step 5.

## How it's organised

The app has four spaces, switched from the top bar (or the bottom bar on a
phone):

- **Overview**: everything added up for the month:
  - your joint goal;
  - income;
  - spending (shared and both personal budgets);
  - savings, and what's left over;
  - each of you at a glance;
  - groceries and the latest meeting.
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
- **Household**:
  - the join code for your partner, and **Lists** (below);
  - the phone address with a QR code;
  - your account: change your password, sign out other devices;
  - **Data**, to download everything.

The gold **+** in the top bar opens **Quick add** (`/add`). Scan a receipt or
type an expense, for the shared budget or your own (`/add?for=personal`).

## Typing it once

These are typed the first time and picked from a dropdown after that:

- sub-categories;
- stores;
- personal categories;
- income sources;
- savings sub-categories;
- groceries.

Names match regardless of capitals or extra spaces, so "checkers" and
"Checkers" are the same store.

To fix a typo, go to **Household → Lists** and rename it. Renaming an entry
to the name of one that already exists merges the two.

## Finding where the money went

Under each budget, **Where it went** lets you filter expenses by:

- category;
- sub-category;
- store;
- who added them (for shared money).

Each filter shows only the options that still apply given the others. For
example, picking a store shows just the categories you've bought there.
Filters live in the URL, so a filtered view can be bookmarked.

## Personal money and the shared pot

"Paid into shared" is money moved from your own funds into the shared pot.
It isn't counted as personal spending, so the overview never counts the
same money twice. Your left-over is:

    income − personal spending − saved − paid into shared

A savings account's starting balance isn't counted as "saved" in the month
you added it. Only later deposits and withdrawals are.

## Groceries and meal preps

- Each grocery line has a name, size, quantity, price (each) and comment.
- Groceries you've bought before remember their last size and price.
- Meal preps group the ingredients for a batch of dinners and show the cost
  per dinner.
- Planning a meal you've prepped before copies its ingredients across.

Tick items off while shopping. Then use **Log the shop** to add the till slip
total to the shared budget as a Food & Toiletries expense.

## Scanning receipts

1. On **Quick add**, tap **Take a photo** (or **Choose a photo**) of a till
   slip.
2. The receipt is read **on your phone**, in the browser. The reading engine
   comes from the app itself, not a third party.
3. The first scan downloads the engine (about 7 MB), which the phone then
   keeps.
4. You get the store, date, total and every line item, each with a category.

Anything it isn't sure of is listed under **things to check**, each with the
part of the photo it came from:

- a store it doesn't know ("Is the store …?"), or no store at all;
- a missing date or total;
- a line that was hard to read, or too blurry to price;
- items that don't add up to the total. You can add the difference as
  "other items" or a discount, or use the items' sum as the total.

**Save** stays off until every check is done.

- Saving adds one expense per category on the receipt to the budget you
  picked (shared or personal).
- Each expense keeps its line items. See them from the receipt icon under
  **Where it went**, or at `/receipts/<id>`.
- Next time the same line turns up, its name and category are filled in
  from last time.
- Item prices also update the remembered price of matching groceries.
- Deleting a receipt deletes the expenses it created.

The photo (shrunk to a sensible size) is saved in the database with the
receipt. Only your household can see it.

## Back Tap: double-tap your iPhone to add an expense

iPhones can run a Shortcut when you double-tap the back of the phone. Point
one at Quick add:

1. On the iPhone, open the **Shortcuts** app, tap **+**, and add the
   **Open URLs** action (search for "URL").
2. Set the URL to the app's address plus `/add`, for example
   `https://moneymoneymoney.<your-subdomain>.workers.dev/add`. Use
   `/add?for=personal` to start on your personal budget. The address is on
   the Household page.
3. Name the shortcut "Add expense" and tap **Done**.
4. Open **Settings → Accessibility → Touch → Back Tap → Double Tap** and
   choose **Add expense**.

Double-tapping the back of the phone now opens Quick add in Safari. Sign in
once in Safari, which keeps its own sign-in separate from the home-screen
app.

## Using it on your iPhones

1. Open the app's address in Safari. The **Household** page shows it with a
   QR code, which you can scan from the other phone.
2. Sign in, then tap **Share → Add to Home Screen → Add**. The app appears as
   "Money" and opens full screen.
3. Open it from the home screen and sign in once more. iOS keeps home-screen
   apps separate from Safari.

## Your data

**Household → Data** downloads everything your household has as one JSON
file, with or without receipt photos. Supabase's free plan doesn't take
backups for you, so download a copy now and then.
[docs/deploy.md](docs/deploy.md#backups) also covers a full database copy.

Lost phone? **Household → Account → Sign out other devices** signs out
everything except the device you're using. Changing your password does the
same.

## Testing

```bash
npm run test           # unit tests (Vitest): budget, flow and grocery maths, receipts, filters, dates, currency
npm run test:e2e       # browser tests (Playwright) of the shared, personal, grocery, receipt and join flows
npm run test:security  # the security audit: attacks a production build (see docs/security-audit.md)
npm run lint
```

The browser tests and the security audit each start their own throwaway
Postgres. The load test is described in
[docs/stress-test.md](docs/stress-test.md).

## Stack

- Next.js (App Router) and TypeScript, deployed to Cloudflare Workers (the
  OpenNext adapter) or Netlify (its Next.js runtime).
- Postgres on Supabase, reached through Cloudflare Hyperdrive, with Drizzle
  ORM and postgres.js. Tables live in their own `app` schema, locked away
  from Supabase's public API.
- Sign-in with encrypted cookies (iron-session) and bcrypt password hashes.
- Tailwind CSS, GSAP for animation, and Recharts for the savings goal chart.
- tesseract.js, reading receipts in the browser.

Code layout:

- `app/`: routes and pages;
- `lib/`: data, actions and receipts;
- `db/`: schema and migrations;
- `scripts/`: local database, migrations, the import from the home
  version, and the test servers.

## Design

A dark evergreen palette with mint and gold accents, and frosted-glass
panels over a slowly drifting aurora. The type is Bricolage Grotesque for
text and numbers, with Instrument Serif italics as accents. Both fonts are
stored in `app/fonts/` (SIL Open Font License, see `app/fonts/OFL.txt`), so
the app never loads fonts from elsewhere.

Motion is in `components/motion/`:

- headings reveal line by line;
- panels fade in as you scroll;
- amounts count up;
- progress bars and rings fill in.

If your device has "reduce motion" turned on, everything appears straight
away with no animation.
