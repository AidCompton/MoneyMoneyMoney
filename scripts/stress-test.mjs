// The stress test: load and concurrency against a running server seeded by
// scripts/seed-stress.mjs. Prints results as JSON (see docs/stress-test.md).
//
//   node scripts/stress-test.mjs --base http://127.0.0.1:3400 --db postgres://...
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, readlinkSync } from "node:fs";
import autocannon from "autocannon";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const base = option("--base", "http://127.0.0.1:3400");
const dbUrl = option("--db", "");
const quick = args.includes("--quick");
const port = new URL(base).port;
const sql = postgres(dbUrl, { max: 2, onnotice: () => {} });

// --- The server process, to read its CPU time --------------------------------
// Linux only: finds the process holding the listening socket for the port
// (the next-server process, not the npx or shell wrappers above it). Pass
// --pid to name it yourself.
function serverPid() {
  try {
    const hexPort = Number(port).toString(16).toUpperCase().padStart(4, "0");
    const inodes = new Set();
    for (const table of ["/proc/net/tcp", "/proc/net/tcp6"]) {
      let lines = [];
      try {
        lines = readFileSync(table, "utf8").trim().split("\n").slice(1);
      } catch {
        continue;
      }
      for (const line of lines) {
        const cols = line.trim().split(/\s+/);
        // cols[1] is local address:port, cols[3] the state (0A = listening).
        if (cols[1].endsWith(`:${hexPort}`) && cols[3] === "0A") inodes.add(cols[9]);
      }
    }
    for (const entry of readdirSync("/proc")) {
      if (!/^\d+$/.test(entry)) continue;
      let fds = [];
      try {
        fds = readdirSync(`/proc/${entry}/fd`);
      } catch {
        continue;
      }
      for (const fd of fds) {
        try {
          const target = readlinkSync(`/proc/${entry}/fd/${fd}`);
          if (inodes.has(target.match(/^socket:\[(\d+)\]$/)?.[1])) return Number(entry);
        } catch {
          // The descriptor closed while reading.
        }
      }
    }
  } catch {
    // Not Linux.
  }
  return null;
}
const pid = Number(option("--pid", "")) || serverPid();
if (!pid) console.error("Couldn't find the server process; CPU per request won't be measured (pass --pid).");
const ticks = Number(execFileSync("getconf", ["CLK_TCK"]).toString()) || 100;
function cpuMs() {
  if (!pid) return 0;
  // Includes child threads; fields 14-15 are user and system time in ticks.
  const fields = readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1].split(" ");
  return ((Number(fields[11]) + Number(fields[12])) / ticks) * 1000;
}

// --- Sign in and capture real requests ---------------------------------------
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const context = await browser.newContext({ reducedMotion: "reduce" });
const page = await context.newPage();
const capture = (match) => page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"] && match(r));
const replayable = (r) => {
  const headers = { ...r.headers() };
  delete headers["content-length"];
  return { url: r.url(), headers, body: r.postData() ?? "" };
};

await page.goto(`${base}/login`);
await page.getByLabel("Email").fill("stress-a@example.com");
await page.getByLabel("Password").fill("Stress-Ledger-2026");
const loginCapture = capture(() => true);
await page.getByRole("button", { name: "Sign in" }).click();
const loginRequest = replayable(await loginCapture);
await page.waitForURL(/dashboard/);
const cookie = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");

const [main] = await sql`select h.id, u.id as user_id from app.households h join app.users u on u.household_id = h.id where u.email = 'stress-a@example.com'`;
const [receipt] = await sql`select id from app.receipts where household_id = ${main.id} limit 1`;
const [store] = await sql`select name from app.labels where household_id = ${main.id} and kind = 'store' limit 1`;
const month = new Date().toISOString().slice(0, 7);

await page.goto(`${base}/budget`);
const expenseCapture = capture((r) => (r.postData() ?? "").includes("stress-capture"));
await page.getByLabel("Amount (R)").fill("12.34");
await page.getByLabel("Note (optional)").fill("stress-capture");
await page.getByRole("combobox", { name: "Store" }).fill("Capture Store");
await page.getByRole("combobox", { name: "Store" }).press("Escape");
await page.getByRole("button", { name: "Add expense" }).click();
const expenseRequest = replayable(await expenseCapture);
await page.getByText("✓ Added").waitFor();

const planCapture = capture((r) => (r.postData() ?? "").includes("plan-"));
const planInputs = page.locator('form input[name^="plan-"]');
const planCount = await planInputs.count();
for (let i = 0; i < planCount; i++) await planInputs.nth(i).fill(String(1000 + i));
await page.getByRole("button", { name: "Save budget" }).click();
const planRequest = replayable(await planCapture);
await page.getByText("✓ Saved").first().waitFor();
await browser.close();

// --- Load ------------------------------------------------------------------------
const results = { pages: [], cpu: [], writes: {}, logins: null, server: { pid } };
const summarize = (r) => ({
  requestsPerSecond: Math.round(r.requests.average),
  p50: r.latency.p50,
  p97_5: r.latency.p97_5,
  p99: r.latency.p99,
  max: r.latency.max,
  ok: r["2xx"],
  failed: r.non2xx + r.errors + r.timeouts,
});

const [meeting] = await sql`select id from app.money_meetings where household_id = ${main.id} limit 1`;
const [goal] = await sql`select id from app.savings_goals where household_id = ${main.id} limit 1`;
const pages = [
  ["dashboard", "/dashboard"],
  ["budget (month)", "/budget"],
  ["budget filtered by store", `/budget?store=${encodeURIComponent(store.name)}`],
  ["personal page", `/personal/${main.user_id}`],
  ["groceries", "/groceries"],
  ["lists", "/household/lists"],
  ["receipt page", `/receipts/${receipt.id}`],
  ["receipt photo", `/api/receipts/${receipt.id}/image`],
  ["export (everything)", "/api/export"],
];

// CPU per request: one request at a time, server CPU time divided by the
// count. Measured while nothing else is running, after a pause so clean-up
// from earlier requests isn't counted. Redirects aren't followed, so a page
// can't quietly measure another.
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function cpuPerRequest(name, path, { signedIn = true, count = 40 } = {}) {
  const get = () => fetch(base + path, { headers: signedIn ? { cookie } : {}, redirect: "manual" });
  for (let i = 0; i < 3; i++) await (await get()).arrayBuffer(); // warm up
  await pause(2000);
  const before = cpuMs();
  for (let i = 0; i < count; i++) {
    const r = await get();
    if (!r.ok) throw new Error(`${path} returned ${r.status}`);
    await r.arrayBuffer();
  }
  results.cpu.push({ name, cpuMsPerRequest: pid ? Math.round(((cpuMs() - before) / count) * 10) / 10 : null });
}
await cpuPerRequest("sign-in page (signed out)", "/login", { signedIn: false });
await cpuPerRequest("goals", "/goals");
await cpuPerRequest("goal page", `/goals/${goal.id}`);
await cpuPerRequest("meetings", "/meetings");
await cpuPerRequest("meeting page", `/meetings/${meeting.id}`);
for (const [name, path] of pages) await cpuPerRequest(name, path);

for (const [name, path] of pages) {
  for (const connections of quick ? [10] : [10, 50]) {
    const r = await autocannon({ url: base + path, connections, duration: quick ? 5 : 15, headers: { cookie } });
    results.pages.push({ name, connections, ...summarize(r) });
  }
}

// --- Concurrent writes --------------------------------------------------------
// 300 expenses from 20 connections at once, all naming the same brand-new
// store: every write must land, and the store must exist exactly once.
let n = 0;
const expenseLoad = await autocannon({
  url: expenseRequest.url,
  connections: 20,
  amount: 300,
  method: "POST",
  headers: { ...expenseRequest.headers, cookie },
  requests: [
    {
      setupRequest: (req) => {
        n++;
        req.body = expenseRequest.body.replace("stress-capture", `race-${String(n).padStart(5, "0")}`).replace("Capture Store", "Race Store");
        return req;
      },
    },
  ],
});
const [{ writes }] = await sql`select count(*)::int as writes from app.expenses where description like 'race-%'`;
const [{ stores }] = await sql`select count(*)::int as stores from app.labels where household_id = ${main.id} and key = 'race store'`;
results.writes.expenses = { ...summarize(expenseLoad), sent: 300, rowsWritten: writes, raceStoreRows: stores };

// 100 budget saves at once for the same month: never two lines for one category.
const planLoad = await autocannon({
  url: planRequest.url,
  connections: 25,
  amount: 100,
  method: "POST",
  headers: { ...planRequest.headers, cookie },
  body: planRequest.body,
});
const duplicates = await sql`
  select category_id, count(*)::int as n from app.budget_lines
  where household_id = ${main.id} and owner_user_id is null and month = ${month}
  group by category_id having count(*) > 1`;
results.writes.budgetPlan = { ...summarize(planLoad), sent: 100, duplicateLines: duplicates.length };

// The budget page lists every expense in the month, so it costs more as the
// month fills up: measure it again now that the month holds the 300 above.
const [{ inMonth }] = await sql`
  select count(*)::int as "inMonth" from app.expenses
  where household_id = ${main.id} and owner_user_id is null and date like ${month + "-%"}`;
await cpuPerRequest(`budget (month with ${inMonth} expenses)`, "/budget");

// --- Sign-ins: deliberately slow password checks, 40 at once -----------------
const loginLoad = await autocannon({
  url: loginRequest.url,
  connections: 10,
  amount: 40,
  method: "POST",
  headers: loginRequest.headers,
  body: loginRequest.body,
});
results.logins = summarize(loginLoad);

console.log(JSON.stringify(results, null, 1));
await sql.end();
