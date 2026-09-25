import { test, expect, type Page } from "@playwright/test";

// Covers the core Money Meeting loop end to end: create a household, log a
// savings contribution, log a grocery expense, and run a meeting with an
// action item; then a partner joins with the household's code and sees the
// same numbers. This is the app's whole reason for existing, so it's the flow
// worth exercising in a real browser rather than just unit tests.

async function register(page: Page, fields: Record<string, string>, button: string) {
  for (const [label, value] of Object.entries(fields)) {
    await page.getByLabel(label).fill(value);
  }
  await page.getByRole("button", { name: button }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("register, track a goal, log a budget, run a meeting, invite a partner", async ({ page, browser }) => {
  // Long flow, and the dev server compiles each route on first visit.
  test.setTimeout(120_000);
  const stamp = Date.now();

  await page.goto("/register");
  await register(
    page,
    {
      "Household name": "The Test Household",
      "Your name": "Aid",
      Email: `test-${stamp}@example.com`,
      Password: "password123",
    },
    "Create household",
  );
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Aid\./ })).toBeVisible();

  // Savings goal
  await page.getByRole("link", { name: "Goals" }).click();
  await page.getByLabel("Goal name").fill("Joint Year-End Goal");
  await page.getByLabel("Target amount (R)").fill("100000");
  await page.getByLabel("Target date (optional)").fill("2099-12-31");
  await page.getByRole("button", { name: "Create goal" }).click();

  await expect(page).toHaveURL(/\/goals\/.+/);
  await page.getByLabel("Amount (R)").fill("5000");
  await page.getByLabel("Note (optional)").fill("Opening deposit");
  await page.getByRole("button", { name: "Add contribution" }).click();
  await expect(page.getByText("Opening deposit")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Joint Year-End Goal progress" })).toHaveAttribute(
    "aria-valuenow",
    "5",
  );

  // Editing the goal
  await page.getByLabel("Target (R)").fill("50000");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("✓ Updated");
  await expect(page.getByRole("progressbar", { name: "Joint Year-End Goal progress" })).toHaveAttribute(
    "aria-valuenow",
    "10",
  );

  // Grocery budget
  await page.getByRole("link", { name: "Budget" }).click();
  await page.getByLabel(/Grocery budget for/).fill("6000");
  await page.getByRole("button", { name: "Set budget" }).click();
  await expect(page.getByLabel("Amount (R)")).toBeVisible();
  for (const [amount, description] of [
    ["450", "Checkers run"],
    ["99", "Mistake"],
  ]) {
    await page.getByLabel("Amount (R)").fill(amount);
    await page.getByLabel("Description").fill(description);
    await page.getByRole("button", { name: "Log expense" }).click();
    await expect(page.getByText(description)).toBeVisible();
  }

  // Deleting an expense takes two clicks.
  const mistake = page.getByRole("listitem").filter({ hasText: "Mistake" });
  await mistake.getByRole("button", { name: "Delete expense" }).click();
  await mistake.getByRole("button", { name: "Confirm: Delete expense" }).click();
  await expect(page.getByText("Mistake")).toHaveCount(0);
  await expect(page.getByRole("progressbar", { name: "Budget spent" }).first()).toHaveAttribute(
    "aria-valuenow",
    "8", // R450 of R6 000
  );

  // Money meeting
  await page.getByRole("link", { name: "Meetings" }).click();
  await page.getByRole("button", { name: /Start this week's meeting/ }).click();

  await expect(page).toHaveURL(/\/meetings\/.+/);
  await page.getByPlaceholder(/What did you decide/).fill("Agreed to cut takeout spend.");
  await page.getByRole("button", { name: "Save notes" }).click();
  await expect(page.getByText("✓ Saved")).toBeVisible();

  await page.getByRole("textbox", { name: "Action item" }).fill("Move R2000 to savings");
  await page.getByRole("button", { name: "Add action item" }).click();
  await expect(page.getByText("Move R2000 to savings")).toBeVisible();

  await page.getByRole("button", { name: "Mark as done" }).click();
  await expect(page.getByText("Move R2000 to savings")).toHaveClass(/line-through/);

  // Partner joins with the code shown on the household page.
  await page.getByRole("link", { name: "Household" }).click();
  const joinCode = (await page.getByLabel("Join code").textContent())?.trim() ?? "";
  expect(joinCode).toMatch(/^[A-Z0-9]{6}$/);

  const partnerContext = await browser.newContext();
  const partner = await partnerContext.newPage();
  await partner.goto("/register");
  await partner.getByRole("button", { name: "Join a household" }).click();
  await register(
    partner,
    {
      "Join code": joinCode.toLowerCase(),
      "Your name": "Sam",
      Email: `partner-${stamp}@example.com`,
      Password: "password123",
    },
    "Join household",
  );
  await expect(partner.getByRole("link", { name: /Joint Year-End Goal/ })).toBeVisible();
  await partner.getByRole("link", { name: "Household" }).click();
  await expect(partner.getByText("Aid", { exact: true })).toBeVisible();
  await partnerContext.close();
});
