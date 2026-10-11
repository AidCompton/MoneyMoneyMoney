// Fills a database with three years of realistic household data, for the
// stress test. Never run this against your real database.
//
//   DATABASE_URL=postgres://...test... node scripts/seed-stress.mjs
//
// Creates "The Stress Test" household (stress-a@example.com and
// stress-b@example.com, password Stress-Ledger-2026) with about 4,000
// expenses, 200 scanned receipts with photos, groceries, savings, goals and
// meetings, plus 30 smaller households so isolation is tested at scale.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url || !/127\.0\.0\.1|localhost/.test(url)) {
  console.error("Refusing: DATABASE_URL must point at a local test database.");
  process.exit(1);
}
const sql = postgres(url, { max: 4, onnotice: () => {} });

let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (list) => list[Math.floor(rand() * list.length)];
const money = (min, max) => Math.round((min + rand() * (max - min)) * 100) / 100;
const pad = (n) => String(n).padStart(2, "0");

const now = new Date();
const months = Array.from({ length: 36 }, (_, i) => {
  const d = new Date(now.getFullYear(), now.getMonth() - 35 + i, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
});
const dayIn = (month) => `${month}-${pad(1 + Math.floor(rand() * 28))}`;

async function insert(table, rows) {
  for (let i = 0; i < rows.length; i += 1000) {
    const batch = rows.slice(i, i + 1000);
    await sql`insert into ${sql("app." + table)} ${sql(batch, Object.keys(batch[0]))}`;
  }
}

const SHARED = ["Food & Toiletries", "Cats", "Gas", "Fun activity", "House", "Miscellaneous", "IOU", "Gifts"];
const PERSONAL = ["Clothes", "Takeaways", "Gym", "Books", "Phone", "Hobbies", "Coffee", "Transport", "Gifts out", "Beauty"];
const STORES = ["Checkers", "Pick n Pay", "Woolworths", "Spar", "Clicks", "Dis-Chem", "Engen", "Shell", "Builders", "Takealot",
  "Food Lover's Market", "Makro", "Petshop Science", "Absolute Pets", "Superbalist", "Mr Price", "Debonairs", "Nando's"];
const key = (name) => name.trim().replace(/\s+/g, " ").toLowerCase();

async function household(name, emails, { expenses: expenseCount, full }) {
  const id = randomUUID();
  await insert("households", [{ id, name, join_code: randomUUID().slice(0, 8).toUpperCase() }]);
  const hash = bcrypt.hashSync("Stress-Ledger-2026", 10);
  const users = emails.map((email, i) => ({ id: randomUUID(), household_id: id, name: i ? "Sam" : "Aid", email, password_hash: hash }));
  await insert("users", users);

  const shared = SHARED.map((n, i) => ({ id: randomUUID(), household_id: id, scope: "shared", name: n, key: key(n), color_index: i }));
  const personal = full ? PERSONAL.map((n, i) => ({ id: randomUUID(), household_id: id, scope: "personal", name: n, key: key(n), color_index: i })) : [];
  await insert("categories", [...shared, ...personal]);
  const subs = full
    ? shared.flatMap((c) => ["Weekly", "Treats", "Bulk", "Other"].map((s) => ({ id: randomUUID(), household_id: id, category_id: c.id, name: s, key: key(s) })))
    : [];
  if (subs.length) await insert("subcategories", subs);
  const stores = STORES.map((s) => ({ id: randomUUID(), household_id: id, kind: "store", name: s, key: key(s) }));
  const sources = ["Salary", "Freelance", "Bonus"].map((s) => ({ id: randomUUID(), household_id: id, kind: "income_source", name: s, key: key(s) }));
  const tags = ["Monthly", "Bonus", "Car service", "Holiday"].map((s) => ({ id: randomUUID(), household_id: id, kind: "savings_tag", name: s, key: key(s) }));
  await insert("labels", [...stores, ...sources, ...tags]);

  const expenses = [];
  for (let i = 0; i < expenseCount; i++) {
    const personalOne = full && rand() < 0.35;
    const owner = personalOne ? pick(users) : null;
    const category = personalOne ? pick(personal) : pick(shared);
    const sub = !personalOne && subs.length && rand() < 0.6 ? pick(subs.filter((s) => s.category_id === category.id)) : null;
    expenses.push({
      id: randomUUID(), household_id: id, owner_user_id: owner?.id ?? null, category_id: category.id,
      subcategory_id: sub?.id ?? null, store_id: rand() < 0.8 ? pick(stores).id : null, user_id: (owner ?? pick(users)).id,
      amount: money(15, 1800), description: pick(["Weekly shop", "Top-up", "Dinner", "Fuel", "Litter", "Present", "Repairs"]),
      date: dayIn(pick(months)),
    });
  }
  await insert("expenses", expenses);
  if (!full) return { id, users };

  const budget = [];
  for (const month of months) {
    for (const c of shared) budget.push({ id: randomUUID(), household_id: id, owner_user_id: null, month, category_id: c.id, amount: money(300, 4000) });
    for (const u of users) for (const c of personal.slice(0, 5)) budget.push({ id: randomUUID(), household_id: id, owner_user_id: u.id, month, category_id: c.id, amount: money(100, 1500) });
  }
  await insert("budget_lines", budget);
  await insert("incomes", months.flatMap((m) => users.map((u) => ({ id: randomUUID(), household_id: id, user_id: u.id, source_id: sources[0].id, amount: money(25000, 40000), date: `${m}-25` }))));
  await insert("shared_contributions", months.flatMap((m) => users.map((u) => ({ id: randomUUID(), household_id: id, user_id: u.id, amount: money(5000, 12000), date: `${m}-26` }))));

  const goals = ["Joint Year-End Goal", "Holiday", "New car"].map((n) => ({ id: randomUUID(), household_id: id, name: n, target_amount: 100000 }));
  await insert("savings_goals", goals);
  await insert("goal_contributions", Array.from({ length: 200 }, () => ({ id: randomUUID(), goal_id: pick(goals).id, user_id: pick(users).id, amount: money(200, 3000), date: dayIn(pick(months)) })));
  const accounts = [...users.map((u) => ({ owner: u.id, name: "Emergency fund" })), { owner: null, name: "Joint holiday" }].map((a) => ({
    id: randomUUID(), household_id: id, owner_user_id: a.owner, name: a.name, opening_balance: money(1000, 20000), opening_date: `${months[0]}-01`,
  }));
  await insert("savings_accounts", accounts);
  await insert("savings_transactions", Array.from({ length: 400 }, () => ({ id: randomUUID(), account_id: pick(accounts).id, user_id: pick(users).id, tag_id: pick(tags).id, amount: rand() < 0.85 ? money(200, 4000) : -money(200, 2000), date: dayIn(pick(months)) })));

  const items = Array.from({ length: 300 }, (_, i) => ({ id: randomUUID(), household_id: id, name: `Grocery ${i}`, key: `grocery ${i}`, last_size: "1kg", last_price: money(10, 120) }));
  await insert("grocery_items", items);
  const preps = months.flatMap((m) => Array.from({ length: 3 }, (_, i) => ({ id: randomUUID(), household_id: id, month: m, name: `Prep ${i}`, key: `prep ${i}`, dinners: 4 })));
  await insert("meal_preps", preps);
  await insert("grocery_list_items", months.flatMap((m) => Array.from({ length: 55 }, () => {
    const prep = rand() < 0.4 ? pick(preps.filter((p) => p.month === m)) : null;
    return { id: randomUUID(), household_id: id, month: m, item_id: pick(items).id, meal_prep_id: prep?.id ?? null, quantity: 1 + Math.floor(rand() * 3), price: money(10, 120), bought: rand() < 0.5, added_by_user_id: pick(users).id };
  })));

  const photo = readFileSync("e2e/fixtures/receipt.jpg");
  const receipts = Array.from({ length: 200 }, () => ({ id: randomUUID(), household_id: id, owner_user_id: null, store_id: pick(stores).id, date: dayIn(pick(months)), total: money(100, 1500), has_image: true, user_id: pick(users).id }));
  await insert("receipts", receipts);
  for (let i = 0; i < receipts.length; i += 50) {
    await insert("receipt_images", receipts.slice(i, i + 50).map((r) => ({ receipt_id: r.id, content_type: "image/jpeg", data: photo })));
  }
  await insert("receipt_items", receipts.flatMap((r) => Array.from({ length: 6 }, (_, i) => ({ id: randomUUID(), receipt_id: r.id, raw: `ITEM ${i}`, name: `Item ${i}`, quantity: 1, unit_price: 20, line_total: 20, category_id: shared[0].id, position: i }))));
  await insert("receipt_aliases", Array.from({ length: 300 }, (_, i) => ({ id: randomUUID(), household_id: id, scope: "shared", key: `item ${i}`, name: `Item ${i}`, category_id: shared[0].id })));

  const meetings = Array.from({ length: 150 }, (_, i) => ({ id: randomUUID(), household_id: id, date: dayIn(months[i % 36]), notes: "Discussed the budget. ".repeat(20) }));
  await insert("money_meetings", meetings);
  await insert("action_items", Array.from({ length: 400 }, () => ({ id: randomUUID(), meeting_id: pick(meetings).id, description: "Move money to savings", assignee_user_id: pick(users).id, done: rand() < 0.7 })));
  return { id, users, receipts, stores };
}

const started = Date.now();
const main = await household("The Stress Test", ["stress-a@example.com", "stress-b@example.com"], { expenses: 4000, full: true });
for (let i = 0; i < 30; i++) {
  await household(`Other ${i}`, [`other-${i}@example.com`], { expenses: 200, full: false });
}
await sql`analyze`;
const [{ n }] = await sql`select count(*)::int as n from app.expenses`;
console.log(JSON.stringify({ householdId: main.id, users: main.users.map((u) => ({ id: u.id, email: u.email })), receiptId: main.receipts[0].id, store: main.stores[0].name, expenses: n, seconds: Math.round((Date.now() - started) / 1000) }));
await sql.end();
