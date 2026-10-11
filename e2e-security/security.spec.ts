import { test, expect, type Browser, type BrowserContext, type Page, type Request } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import postgres from "postgres";

// The security audit. Each test is an attack (or a check of a defence); they
// run in order against one production server and share the households below.
//
//   Household A: Aid (a@...) and Sam (a2@...), created through the app.
//   Household B: Bea (b@...) and a lock-out test account, created directly.

test.describe.configure({ mode: "serial" });

const sql = postgres(`postgres://postgres:postgres@127.0.0.1:${process.env.TEST_PG_PORT ?? 5435}/moneymoneymoney_test`, {
  max: 2,
  onnotice: () => {},
});
test.afterAll(async () => sql.end());

const PASSWORD_A = "Tidy-Ledger-2026";
const PASSWORD_B = "Other-Ledger-2026";
const A1 = "aid-owner@example.com";
const A2 = "sam-partner@example.com";
const B1 = "bea-other@example.com";
const LOCK = "lock-me-out@example.com";

const sessionSecret = readFileSync(".env.local", "utf8").match(/^SESSION_SECRET=(.*)$/m)?.[1] ?? "no-secret-found";

// Each scenario gets its own client address, so rate limits don't leak between tests.
let nextIp = 10;
async function newContext(browser: Browser) {
  return browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${nextIp++}` } });
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Sets (or adds) a form field before submitting, as an attacker editing the page would. */
async function tamper(page: Page, formHas: string, name: string, value: string) {
  // Wait until React has hydrated the form, so it doesn't reset the field afterwards.
  await page.waitForFunction((formHas) => {
    const form = [...document.querySelectorAll("form")].find((f) => f.textContent?.includes(formHas));
    return !!form && Object.keys(form).some((k) => k.startsWith("__reactProps"));
  }, formHas);
  await page.evaluate(
    ({ formHas, name, value }) => {
      const form = [...document.querySelectorAll("form")].find((f) => f.textContent?.includes(formHas));
      if (!form) throw new Error(`form with "${formHas}" not found`);
      let field = form.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
      if (field instanceof HTMLSelectElement) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = "tampered";
        field.appendChild(option);
        field.value = value;
        return;
      }
      if (!field) {
        field = document.createElement("input");
        field.type = "hidden";
        field.name = name;
        form.appendChild(field);
      }
      field.value = value;
    },
    { formHas, name, value },
  );
}

/**
 * An HTTP request carrying a context's session cookie. (Playwright's request
 * client won't send a Secure cookie over plain http, so it's added by hand,
 * exactly as an attacker's own tool would.)
 */
async function authed(ctx: BrowserContext, path: string, init: Parameters<Page["request"]["fetch"]>[1] = {}) {
  const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  return page.request.fetch(path, { ...init, headers: { ...(init.headers ?? {}), cookie } });
}

const ids: Record<string, string> = {};
let ctxA: BrowserContext;
let pageA: Page;
let ctxB: BrowserContext;
let pageB: Page;
let createRequest: { url: string; headers: Record<string, string>; body: string } | null = null;

test("1. the first household can be created, and then sign-up closes", async ({ browser }) => {
  ctxA = await newContext(browser);
  pageA = await ctxA.newPage();
  pageA.on("request", (r: Request) => {
    if (r.method() === "POST" && r.headers()["next-action"] && r.postData()?.includes(A1)) {
      createRequest = { url: r.url(), headers: r.headers(), body: r.postData()! };
    }
  });
  await pageA.goto("/register");
  await pageA.getByLabel("Household name").fill("Household A");
  await pageA.getByLabel("Your name").fill("Aid");
  await pageA.getByLabel("Email").fill(A1);
  await pageA.getByLabel("Password").fill(PASSWORD_A);
  await pageA.getByRole("button", { name: "Create household" }).click();
  await expect(pageA).toHaveURL(/\/dashboard/);

  // A visitor now only gets the join form...
  const visitor = await (await newContext(browser)).newPage();
  await visitor.goto("/register");
  await expect(visitor.getByRole("link", { name: "New household" })).toHaveCount(0);
  await expect(visitor.getByLabel("Join code")).toBeVisible();

  // ...and replaying the sign-up request (another email, same length) is refused.
  expect(createRequest).not.toBeNull();
  const replay = await visitor.request.fetch(createRequest!.url, {
    method: "POST",
    headers: createRequest!.headers,
    data: createRequest!.body.replace(A1, A1.replace("aid-owner", "aid-intrud")),
  });
  expect(await replay.text()).toContain("New households can't be created here");
  const [{ n }] = await sql`select count(*)::int as n from app.households`;
  expect(n).toBe(1);
});

test("2. the session cookie is __Host-, Secure, HttpOnly and SameSite=Lax", async () => {
  const cookie = (await ctxA.cookies()).find((c) => c.name.includes("mmm_session"));
  expect(cookie?.name).toBe("__Host-mmm_session");
  expect(cookie?.secure).toBe(true);
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  expect(cookie?.path).toBe("/");
});

test("3. security headers are on every page", async ({ request }) => {
  for (const path of ["/login", "/register", "/dashboard", "/budget", "/ocr/worker.min.js"]) {
    const signedOutPage = path === "/login" || path === "/register";
    const response = signedOutPage ? await request.get(path, { maxRedirects: 0 }) : await authed(ctxA, path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(200);
    const h = response.headers();
    expect(h["x-content-type-options"], path).toBe("nosniff");
    expect(h["x-frame-options"], path).toBe("DENY");
    expect(h["referrer-policy"], path).toBe("same-origin");
    expect(h["strict-transport-security"], path).toContain("max-age=");
    expect(h["permissions-policy"], path).toContain("camera=()");
    expect(h["content-security-policy"], path).toContain("default-src 'self'");
    expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(h["x-powered-by"], path).toBeUndefined();
  }
});

test("4. setting up the other household and the shared data", async ({ browser }) => {
  // Sam joins household A with its code.
  const [{ join_code: codeA, id: householdA }] = await sql`select join_code, id from app.households`;
  ids.householdA = householdA;
  ids.codeA = codeA;
  const sam = await (await newContext(browser)).newPage();
  await sam.goto(`/register?code=${codeA}`);
  await sam.getByLabel("Your name").fill("Sam");
  await sam.getByLabel("Email").fill(A2);
  await sam.getByLabel("Password").fill(PASSWORD_A);
  await sam.getByRole("button", { name: "Join household" }).click();
  await expect(sam).toHaveURL(/\/dashboard/);

  // Household B, created directly (sign-up is closed).
  ids.householdB = randomUUID();
  ids.b1 = randomUUID();
  const hashB = bcrypt.hashSync(PASSWORD_B, 10);
  await sql`insert into app.households (id, name, join_code) values (${ids.householdB}, 'Household B', 'BBBBCCCC')`;
  await sql`insert into app.users (id, household_id, name, email, password_hash) values
    (${ids.b1}, ${ids.householdB}, 'Bea', ${B1}, ${hashB}),
    (${randomUUID()}, ${ids.householdB}, 'Lock', ${LOCK}, ${hashB})`;

  ctxB = await newContext(browser);
  pageB = await ctxB.newPage();
  await signIn(pageB, B1, PASSWORD_B);
  await expect(pageB).toHaveURL(/\/dashboard/);
  await pageB.goto("/budget"); // creates B's categories

  // Data in household A that B will try to reach.
  const [a1] = await sql`select id from app.users where email = ${A1}`;
  ids.a1 = a1.id;
  const [catA] = await sql`select id from app.categories where household_id = ${householdA} limit 1`;
  const [catB] = await sql`select id from app.categories where household_id = ${ids.householdB} limit 1`;
  const tinyJpeg = Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==", "base64");
  for (const [key, value] of Object.entries({
    goalA: randomUUID(), meetingA: randomUUID(), accountA: randomUUID(), expenseA: randomUUID(),
    receiptA: randomUUID(), labelA: randomUUID(), prepA: randomUUID(),
    goalB: randomUUID(), meetingB: randomUUID(), accountB: randomUUID(), expenseB: randomUUID(), labelB: randomUUID(),
  })) ids[key] = value;
  await sql`insert into app.savings_goals (id, household_id, name, target_amount) values
    (${ids.goalA}, ${householdA}, 'A secret goal', 1000), (${ids.goalB}, ${ids.householdB}, 'B goal', 500)`;
  await sql`insert into app.money_meetings (id, household_id, date, notes) values
    (${ids.meetingA}, ${householdA}, '2026-10-01', 'A private notes'), (${ids.meetingB}, ${ids.householdB}, '2026-10-01', '')`;
  await sql`insert into app.savings_accounts (id, household_id, owner_user_id, name, opening_balance, opening_date) values
    (${ids.accountA}, ${householdA}, ${ids.a1}, 'A account', 1000, '2026-01-01'),
    (${ids.accountB}, ${ids.householdB}, ${ids.b1}, 'B account', 100, '2026-01-01')`;
  await sql`insert into app.labels (id, household_id, kind, name, key) values
    (${ids.labelA}, ${householdA}, 'store', 'A Secret Store', 'a secret store'),
    (${ids.labelB}, ${ids.householdB}, 'store', 'B Store', 'b store')`;
  const month = new Date().toISOString().slice(0, 7);
  await sql`insert into app.expenses (id, household_id, category_id, user_id, amount, description, date) values
    (${ids.expenseA}, ${householdA}, ${catA.id}, ${ids.a1}, 42, 'A private expense', ${month + "-02"}),
    (${ids.expenseB}, ${ids.householdB}, ${catB.id}, ${ids.b1}, 7, 'B expense', ${month + "-02"})`;
  await sql`insert into app.receipts (id, household_id, store_id, date, total, has_image, user_id) values
    (${ids.receiptA}, ${householdA}, ${ids.labelA}, '2026-10-01', 42, true, ${ids.a1})`;
  await sql`insert into app.receipt_images (receipt_id, content_type, data) values (${ids.receiptA}, 'image/jpeg', ${tinyJpeg})`;
  await sql`insert into app.meal_preps (id, household_id, month, name, key) values (${ids.prepA}, ${householdA}, ${month}, 'A prep', 'a prep')`;
});

test("5. signed-out visitors can't see anything", async ({ browser }) => {
  const visitor = await (await newContext(browser)).newPage();
  for (const path of ["/dashboard", "/budget", "/groceries", "/goals", "/meetings", "/household", "/household/lists", "/add",
    `/personal/${ids.a1}`, `/goals/${ids.goalA}`, `/receipts/${ids.receiptA}`]) {
    await visitor.goto(path);
    await expect(visitor, path).toHaveURL(/\/login$/);
    expect(await visitor.content(), path).not.toContain("Household A");
  }
  expect((await visitor.request.get("/api/export")).status()).toBe(401);
  expect((await visitor.request.get(`/api/receipts/${ids.receiptA}/image`)).status()).toBe(404);
});

test("6. guessing a password locks the account out (and unknown emails take as long)", async ({ browser }) => {
  const attacker = await (await newContext(browser)).newPage();
  // An unknown email still runs the slow password check (no timing tell).
  const started = Date.now();
  await signIn(attacker, "nobody-here@example.com", "Wrong-Password-1");
  await expect(attacker.locator("form").getByRole("alert")).toHaveText("Incorrect email or password.");
  expect(Date.now() - started).toBeGreaterThan(40);

  const guesser = await (await newContext(browser)).newPage();
  for (let i = 0; i < 8; i++) {
    await signIn(guesser, LOCK, `Wrong-Guess-${i}`);
    await expect(guesser.locator("form").getByRole("alert")).toHaveText("Incorrect email or password.");
  }
  // The right password no longer works for a while, from any address.
  await signIn(guesser, LOCK, PASSWORD_B);
  await expect(guesser.locator("form").getByRole("alert")).toContainText("Too many attempts");
  const elsewhere = await (await newContext(browser)).newPage();
  await signIn(elsewhere, LOCK, PASSWORD_B);
  await expect(elsewhere.locator("form").getByRole("alert")).toContainText("Too many attempts");
});

test("7. guessing join codes gets locked out", async ({ browser }) => {
  const guesser = await (await newContext(browser)).newPage();
  for (let i = 0; i < 11; i++) {
    await guesser.goto("/register?join");
    await guesser.getByLabel("Join code").fill(i === 10 ? ids.codeA : `ZZZZZZ${i}A`);
    await guesser.getByLabel("Your name").fill("Mallory");
    await guesser.getByLabel("Email").fill(`mallory${i}@example.com`);
    await guesser.getByLabel("Password").fill("Mallory-Ledger-99");
    await guesser.getByRole("button", { name: "Join household" }).click();
    await expect(guesser.locator("form").getByRole("alert")).toHaveText(
      i < 10 ? "We couldn't find a household with that code." : /Too many attempts/,
    );
  }
});

test("8. a full household can't be joined, even with the right code", async ({ browser }) => {
  const third = await (await newContext(browser)).newPage();
  await third.goto(`/register?code=${ids.codeA}`);
  await third.getByLabel("Your name").fill("Third");
  await third.getByLabel("Email").fill("third-wheel@example.com");
  await third.getByLabel("Password").fill("Third-Ledger-2026");
  await third.getByRole("button", { name: "Join household" }).click();
  await expect(third.locator("form").getByRole("alert")).toHaveText("That household is already full.");
  const [{ n }] = await sql`select count(*)::int as n from app.users where household_id = ${ids.householdA}`;
  expect(n).toBe(2);
});

test("9. another household's pages, photos and export are out of reach", async () => {
  for (const path of [`/goals/${ids.goalA}`, `/meetings/${ids.meetingA}`, `/receipts/${ids.receiptA}`, `/personal/${ids.a1}`,
    `/personal/${ids.a1}/savings`, `/personal/${ids.b1}/savings/${ids.accountA}`]) {
    const response = await pageB.goto(path);
    expect(response?.status(), path).toBe(404);
    const html = await pageB.content();
    for (const secret of ["A secret goal", "A private notes", "A Secret Store", "A account", "A private expense"]) {
      expect(html, `${path} leaks ${secret}`).not.toContain(secret);
    }
  }
  expect((await authed(ctxB, `/api/receipts/${ids.receiptA}/image`)).status()).toBe(404);
  // A can see its own photo.
  expect((await authed(ctxA, `/api/receipts/${ids.receiptA}/image`)).status()).toBe(200);

  const exportResponse = await authed(ctxB, "/api/export?images=1");
  expect(exportResponse.status()).toBe(200);
  const exported = await exportResponse.text();
  expect(exported).toContain(ids.goalB);
  for (const key of ["householdA", "a1", "goalA", "meetingA", "accountA", "expenseA", "receiptA", "labelA", "prepA"]) {
    expect(exported, key).not.toContain(ids[key]);
  }
});

test("10. tampered forms can't touch another household's records", async () => {
  // A contribution to A's goal from B's goal page.
  await pageB.goto(`/goals/${ids.goalB}`);
  await pageB.getByLabel("Amount (R)").first().fill("999");
  await tamper(pageB, "Add contribution", "goalId", ids.goalA);
  await pageB.getByRole("button", { name: "Add contribution" }).click();
  await expect(pageB.getByText("That goal could not be found.")).toBeVisible();

  // An action item on A's meeting, and assigning a task to someone in A.
  await pageB.goto(`/meetings/${ids.meetingB}`);
  await pageB.getByLabel("Action item").fill("Hacked task");
  await tamper(pageB, "Add action item", "meetingId", ids.meetingA);
  await pageB.getByRole("button", { name: "Add action item" }).click();
  await expect(pageB.getByText("That meeting could not be found.")).toBeVisible();
  await pageB.goto(`/meetings/${ids.meetingB}`);
  await pageB.getByLabel("Action item").fill("Task for a stranger");
  await tamper(pageB, "Add action item", "assigneeUserId", ids.a1);
  await pageB.getByRole("button", { name: "Add action item" }).click();
  await expect(pageB.getByText("Pick someone in your household.")).toBeVisible();
  // Overwriting A's meeting notes.
  await pageB.goto(`/meetings/${ids.meetingB}`);
  await pageB.getByLabel("Meeting notes").fill("Overwritten by B");
  await tamper(pageB, "Save notes", "meetingId", ids.meetingA);
  await pageB.getByRole("button", { name: "Save notes" }).click();
  await expect(pageB.getByText("That meeting could not be found.")).toBeVisible();

  // A deposit into A's savings account.
  await pageB.goto(`/personal/${ids.b1}/savings/${ids.accountB}`);
  await pageB.locator("#tx-amount").fill("5000");
  await tamper(pageB, "Deposit or withdrawal", "accountId", ids.accountA);
  await pageB.locator("form").filter({ has: pageB.locator("#tx-amount") }).getByRole("button", { name: "Save" }).click();
  await expect(pageB.getByText("Pick one of your accounts.")).toBeVisible();

  // Renaming A's store.
  await pageB.goto("/household/lists");
  await pageB.getByRole("listitem").filter({ hasText: "B Store" }).getByRole("button", { name: "Rename" }).click();
  await pageB.getByLabel("New name for B Store").fill("Pwned");
  await tamper(pageB, "Save", "id", ids.labelA);
  await pageB.getByRole("button", { name: "Save", exact: true }).click();
  await expect(pageB.getByText("Not found.")).toBeVisible();

  // Adding a grocery to A's meal prep.
  await pageB.goto("/groceries");
  // The general list starts open when it's empty.
  const addButton = pageB.getByRole("button", { name: "Add a grocery" });
  if (await addButton.count()) await addButton.first().click();
  await pageB.getByRole("combobox", { name: "Grocery", exact: true }).first().fill("Sneaky item");
  await pageB.getByRole("combobox", { name: "Grocery", exact: true }).first().press("Escape");
  await tamper(pageB, "Add to list", "mealPrepId", ids.prepA);
  await pageB.getByRole("button", { name: "Add to list" }).first().click();
  await expect(pageB.getByText("That meal prep could not be found.")).toBeVisible();

  // Nothing in A changed.
  const [{ c }] = await sql`select count(*)::int as c from app.goal_contributions where goal_id = ${ids.goalA}`;
  const [{ i }] = await sql`select count(*)::int as i from app.action_items where meeting_id = ${ids.meetingA}`;
  const [{ notes }] = await sql`select notes from app.money_meetings where id = ${ids.meetingA}`;
  const [{ t }] = await sql`select count(*)::int as t from app.savings_transactions where account_id = ${ids.accountA}`;
  const [{ name }] = await sql`select name from app.labels where id = ${ids.labelA}`;
  const [{ g }] = await sql`select count(*)::int as g from app.grocery_list_items where meal_prep_id = ${ids.prepA}`;
  expect({ c, i, notes, t, name, g }).toEqual({ c: 0, i: 0, notes: "A private notes", t: 0, name: "A Secret Store", g: 0 });
});

test("11. replaying a delete with another household's id does nothing", async () => {
  await pageB.goto("/budget");
  const row = pageB.getByRole("listitem").filter({ hasText: "B expense" });
  await row.scrollIntoViewIfNeeded();
  const captured = pageB.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
  await row.getByRole("button", { name: /Delete/ }).click();
  await row.getByRole("button", { name: /Confirm/ }).click();
  const request = await captured;
  const body = request.postData() ?? "";
  expect(body).toContain(ids.expenseB);

  // The same request for B's own (already deleted) expense goes through,
  // showing the replay itself is valid...
  const control = await authed(ctxB, request.url(), { method: "POST", headers: request.headers(), data: body });
  expect(control.status()).toBe(200);
  // ...and with A's expense id instead, it changes nothing.
  const replay = await authed(ctxB, request.url(), {
    method: "POST",
    headers: request.headers(),
    data: body.replaceAll(ids.expenseB, ids.expenseA),
  });
  expect(replay.status()).toBeLessThan(500);
  const [{ n }] = await sql`select count(*)::int as n from app.expenses where id = ${ids.expenseA}`;
  expect(n).toBe(1);
});

test("12. a forged cross-site request is refused", async () => {
  await pageB.goto("/budget");
  const captured = pageB.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
  await pageB.getByLabel("Amount (R)").fill("11");
  await pageB.getByLabel("Note (optional)").fill("legit-expense");
  await pageB.getByRole("button", { name: "Add expense" }).click();
  const request = await captured;
  await expect(pageB.getByText("✓ Added")).toBeVisible();

  // Replayed from this site, it works (so the request itself is valid)...
  const sameSite = await authed(ctxB, request.url(), {
    method: "POST",
    headers: request.headers(),
    data: (request.postData() ?? "").replace("legit-expense", "replay-expense"),
  });
  expect(sameSite.status()).toBe(200);
  const [{ r }] = await sql`select count(*)::int as r from app.expenses where description = 'replay-expense'`;
  expect(r).toBe(1);
  // ...but sent from another site, it's refused.
  const forged = await authed(ctxB, request.url(), {
    method: "POST",
    headers: { ...request.headers(), origin: "https://evil.example" },
    data: (request.postData() ?? "").replace("legit-expense", "forged-expense"),
  });
  expect(forged.status()).toBeGreaterThanOrEqual(400);
  const [{ n }] = await sql`select count(*)::int as n from app.expenses where description = 'forged-expense'`;
  expect(n).toBe(0);
});

test("13. no page ever contains a password hash or the session secret", async () => {
  const bodies: string[] = [];
  pageA.on("response", async (r) => {
    const type = r.headers()["content-type"] ?? "";
    if (type.includes("text/html") || type.includes("text/x-component") || type.includes("json")) {
      bodies.push(await r.text().catch(() => ""));
    }
  });
  for (const path of ["/dashboard", "/budget", "/groceries", "/goals", "/meetings", `/meetings/${ids.meetingA}`, "/household",
    "/household/lists", "/add", `/personal/${ids.a1}`, `/personal/${ids.a1}/savings`, `/goals/${ids.goalA}`, `/receipts/${ids.receiptA}`]) {
    await pageA.goto(path);
  }
  const exportResponse = await authed(ctxA, "/api/export?images=1");
  expect(exportResponse.status()).toBe(200);
  bodies.push(await exportResponse.text());
  const everything = bodies.join("\n");
  expect(everything.length).toBeGreaterThan(10_000);
  expect(everything).not.toContain("$2b$");
  expect(everything).not.toContain("$2a$");
  expect(everything).not.toMatch(/password_?hash/i);
  expect(everything).not.toContain(sessionSecret);
});

test("14. text that looks like code is shown as text, never run", async () => {
  let dialogs = 0;
  pageA.on("dialog", async (d) => {
    dialogs++;
    await d.dismiss();
  });
  await pageA.goto("/budget");
  await pageA.getByLabel("Amount (R)").fill("1");
  await pageA.getByLabel("Note (optional)").fill('<img src=x onerror="alert(1)">');
  await pageA.getByRole("combobox", { name: "Store" }).fill("<script>alert(2)</script>");
  await pageA.getByRole("combobox", { name: "Store" }).press("Escape");
  await pageA.getByRole("button", { name: "Add expense" }).click();
  await expect(pageA.getByText("✓ Added")).toBeVisible();
  for (const path of ["/budget", "/household/lists", "/dashboard"]) {
    await pageA.goto(path);
    await pageA.waitForTimeout(500);
  }
  await pageA.goto("/budget");
  await expect(pageA.getByText('<img src=x onerror="alert(1)">').first()).toBeAttached();
  expect(dialogs).toBe(0);
});

test("15. nonsense input is refused or trimmed", async () => {
  await pageA.goto("/budget");
  const form = pageA.locator("form").filter({ has: pageA.getByRole("button", { name: "Add expense" }) });
  for (const amount of ["1000000000000", "-5", "abc"]) {
    // Bypass the browser's own number checks, as a script would.
    await form.getByLabel("Amount (R)").evaluate((el: HTMLInputElement, value) => {
      el.type = "text";
      el.removeAttribute("min");
      el.removeAttribute("step");
      el.value = value;
    }, amount);
    await form.getByRole("button", { name: "Add expense" }).click();
    await expect(form.getByRole("alert")).toHaveText("Amount must be a positive number.");
  }
  await form.getByLabel("Amount (R)").fill("10");
  await form.evaluate((f) => {
    const date = f.querySelector<HTMLInputElement>('input[name="date"]')!;
    date.type = "text";
    date.value = "2026-02-31";
  });
  await form.getByRole("button", { name: "Add expense" }).click();
  await expect(form.getByRole("alert")).toHaveText("Pick a date in the month you're viewing.");

  await pageA.goto("/budget");
  await form.getByLabel("Amount (R)").fill("3");
  await form.getByLabel("Note (optional)").evaluate((el: HTMLInputElement) => {
    el.removeAttribute("maxlength");
    el.value = "x".repeat(5000);
  });
  await form.getByRole("button", { name: "Add expense" }).click();
  await expect(pageA.getByText("✓ Added")).toBeVisible();
  const [{ longest }] = await sql`select max(length(description))::int as longest from app.expenses`;
  expect(longest).toBeLessThanOrEqual(200);
});

test("16. sessions can be revoked: other devices, password change, tampered cookies", async ({ browser }) => {
  // A second device for Aid.
  const other = await (await newContext(browser)).newPage();
  await signIn(other, A1, PASSWORD_A);
  await expect(other).toHaveURL(/\/dashboard/);

  await pageA.goto("/household");
  await pageA.getByRole("button", { name: "Sign out other devices" }).click();
  await expect(pageA.getByText("Every other device has been signed out.")).toBeVisible();
  await other.goto("/budget");
  await expect(other).toHaveURL(/\/login$/);
  await pageA.goto("/budget");
  await expect(pageA).toHaveURL(/\/budget$/);

  // Changing the password signs out everything else; the old password stops working.
  const newPassword = "Brand-New-Ledger-27";
  const another = await (await newContext(browser)).newPage();
  await signIn(another, A1, PASSWORD_A);
  await expect(another).toHaveURL(/\/dashboard/);
  await pageA.goto("/household");
  await pageA.getByLabel("Current password").fill(PASSWORD_A);
  await pageA.getByLabel("New password", { exact: true }).fill(newPassword);
  await pageA.getByLabel("New password again").fill(newPassword);
  await pageA.getByRole("button", { name: "Change password" }).click();
  await expect(pageA.getByText("Password changed.")).toBeVisible();
  await another.goto("/budget");
  await expect(another).toHaveURL(/\/login$/);
  const oldPassword = await (await newContext(browser)).newPage();
  await signIn(oldPassword, A1, PASSWORD_A);
  await expect(oldPassword.locator("form").getByRole("alert")).toHaveText("Incorrect email or password.");
  await signIn(oldPassword, A1, newPassword);
  await expect(oldPassword).toHaveURL(/\/dashboard/);

  // A cookie edited by hand counts as signed out.
  const cookie = (await ctxA.cookies()).find((c) => c.name === "__Host-mmm_session")!;
  const forgedCtx = await newContext(browser);
  const flipped = cookie.value.slice(0, 40) + (cookie.value[40] === "A" ? "B" : "A") + cookie.value.slice(41);
  await forgedCtx.addCookies([{ ...cookie, value: flipped }]);
  const forged = await forgedCtx.newPage();
  await forged.goto("/dashboard");
  await expect(forged).toHaveURL(/\/login$/);
});

test("17. the database is locked away from Supabase's API roles", async () => {
  const tables = await sql`
    select c.relname as name, c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'app' and c.relkind = 'r'`;
  expect(tables.length).toBeGreaterThanOrEqual(23);
  for (const t of tables) expect(t.rls, `${t.name} has row level security`).toBe(true);

  for (const role of ["anon", "authenticated", "service_role"]) {
    const [{ usage }] = await sql`select has_schema_privilege(${role}, 'app', 'USAGE') as usage`;
    expect(usage, `${role} can use schema app`).toBe(false);
    for (const t of tables) {
      const [p] = await sql`select
        has_table_privilege(${role}, ${"app." + t.name}, 'SELECT') as s,
        has_table_privilege(${role}, ${"app." + t.name}, 'INSERT') as i,
        has_table_privilege(${role}, ${"app." + t.name}, 'UPDATE') as u,
        has_table_privilege(${role}, ${"app." + t.name}, 'DELETE') as d`;
      expect(p, `${role} on ${t.name}`).toEqual({ s: false, i: false, u: false, d: false });
    }
  }
});
