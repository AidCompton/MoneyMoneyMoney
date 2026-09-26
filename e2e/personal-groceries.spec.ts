import { test, expect, type Page } from "@playwright/test";

// The personal side and the grocery planner: income, paying into the shared
// pot, a personal category typed in once, a savings account, the grocery list
// with a meal prep, cross-filtering shared expenses by store, and merging a
// mistyped store on the Lists page.

async function pick(page: Page, label: string, value: string) {
  const box = page.getByRole("combobox", { name: label, exact: true });
  await box.fill(value);
  await box.press("Escape");
}

test("personal money, savings, groceries, filters and lists", async ({ page }) => {
  test.setTimeout(180_000);
  const stamp = Date.now();

  await page.goto("/register");
  await page.getByLabel("Household name").fill("The Personal Test");
  await page.getByLabel("Your name").fill("Aid");
  await page.getByLabel("Email").fill(`personal-${stamp}@example.com`);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create household" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // --- Personal: income, the shared pot, a new category and an expense in it
  await page.getByRole("link", { name: "Personal" }).first().click();
  await expect(page).toHaveURL(/\/personal\/.+/);
  const personalUrl = page.url();

  await pick(page, "Source", "Salary");
  await page.locator("#income-amount").fill("30000");
  await page.getByRole("button", { name: "Add income" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Salary" })).toBeVisible();

  await page.locator("#contribution-amount").fill("10000");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Shared pot" })).toBeVisible();

  await pick(page, "Your first category", "Clothes");
  await page.getByLabel("Planned amount for the new category").fill("1500");
  await page.getByRole("button", { name: "Save budget" }).click();
  await expect(page.getByRole("spinbutton", { name: "Clothes" })).toHaveValue("1500");

  await pick(page, "Category", "clothes"); // different case: same category
  await pick(page, "Sub-category", "Shoes");
  await pick(page, "Store", "Superbalist");
  await page.locator("#personal-amount").fill("1200");
  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Clothes › Shoes · Superbalist" })).toBeVisible();

  // 30 000 in − 1 200 spent − 10 000 to the shared pot
  await expect(page.getByRole("img", { name: /Spent R 1 200, Paid into shared R 10 000, Left over R 18 800/ })).toBeVisible();

  // --- Savings: a new account and a deposit
  await page.getByRole("link", { name: "Savings" }).first().click();
  await expect(page.getByRole("heading", { name: /^Savings,/ })).toBeVisible();
  await page.getByLabel("Account name").fill("Emergency fund");
  await page.getByLabel("Balance right now (R)").fill("5000");
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(page).toHaveURL(/\/savings\/.+/);
  await page.locator("#tx-amount").fill("2000");
  await pick(page, "Sub-category", "Bonus");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Bonus" })).toBeVisible();
  await expect(page.getByText("R 7 000", { exact: true })).toBeVisible();

  // The deposit now counts as saved on the personal page (the opening balance doesn't).
  await page.goto(personalUrl);
  await expect(page.getByRole("img", { name: /Saved R 2 000, Left over R 16 800/ })).toBeVisible();

  // --- Groceries: a general item, a meal prep, and last price remembered
  await page.getByRole("link", { name: "Shared" }).first().click();
  await page.getByRole("link", { name: "Groceries", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Groceries,/ })).toBeVisible();

  const general = page.locator("form").filter({ has: page.locator("input[name=month]") }).filter({
    hasNot: page.locator("input[name=mealPrepId]"),
  });
  await general.getByRole("combobox", { name: "Grocery" }).fill("Milk");
  await general.getByLabel("Size").fill("2L");
  await general.getByLabel("Qty").fill("2");
  await general.getByLabel("Price (R)").fill("30");
  await general.getByRole("button", { name: "Add to list" }).click();
  await expect(page.getByRole("button", { name: "Mark Milk as bought" })).toBeVisible();

  await pick(page, "Meal", "Stir-fry");
  await page.getByLabel("Dinners it covers").fill("4");
  await page.getByRole("button", { name: "Plan meal prep" }).click();
  await expect(page.getByRole("heading", { name: "Stir-fry" })).toBeVisible();

  const prep = page.locator("form").filter({ has: page.locator("input[name=mealPrepId]") }).first();
  await prep.getByRole("combobox", { name: "Grocery" }).fill("Chicken");
  await prep.getByLabel("Price (R)").fill("100");
  await prep.getByRole("button", { name: "Add to list" }).click();
  await expect(page.getByText("R 25 per dinner")).toBeVisible();

  // No price typed: it takes Milk's last price.
  await prep.getByRole("combobox", { name: "Grocery" }).fill("milk");
  await prep.getByRole("combobox", { name: "Grocery" }).press("Escape");
  await prep.getByRole("button", { name: "Add to list" }).click();
  await expect(page.getByText("1 × R 30")).toBeVisible();

  const milk = page.getByRole("button", { name: "Mark Milk as bought" }).first();
  await milk.click();
  await expect(page.getByRole("button", { name: "Put Milk back on the list" }).first()).toHaveAttribute("aria-pressed", "true");

  // --- Shared expenses at two stores (one mistyped), then filter by store
  await page.getByRole("link", { name: "Budget", exact: true }).click();
  // Both pages have a Store field, so wait for the budget page proper.
  await expect(page.getByRole("heading", { name: /^Spending,/ })).toBeVisible();
  for (const [store, amount] of [
    ["Checkers", "450"],
    ["Chekers", "120"],
    ["Engen", "900"],
  ]) {
    await pick(page, "Store", store);
    await page.getByLabel("Amount (R)").fill(amount);
    await page.getByRole("button", { name: "Add expense" }).click();
    await expect(page.locator("#explore").getByRole("link", { name: new RegExp(`^${store}`) })).toBeVisible();
  }
  await page.locator("#explore").getByRole("link", { name: /^Engen/ }).click();
  await expect(page).toHaveURL(/store=/);
  await expect(page.locator("#explore").getByText("R 900 across 1 expense")).toBeVisible();

  // --- Lists: rename the typo into the real store, merging them
  await page.getByRole("link", { name: "Household" }).first().click();
  await page.getByRole("link", { name: "Lists", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Your lists,/ })).toBeVisible();
  const typo = page.getByRole("listitem").filter({ hasText: "Chekers" });
  await typo.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("New name for Chekers").fill("Checkers");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Chekers" })).toHaveCount(0);
  await expect(page.getByRole("listitem").filter({ hasText: "Checkers" })).toContainText("Used 2 times");

  // --- Overview adds it all up
  await page.getByRole("link", { name: "Overview" }).first().click();
  await expect(page.getByText("Everything saved")).toBeVisible();
  await expect(page.getByRole("img", { name: /Shared spending R 1 470/ })).toBeVisible();
});
