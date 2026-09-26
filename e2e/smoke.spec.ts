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

  // Savings goal (shared space)
  await page.getByRole("link", { name: "Shared" }).first().click();
  await page.getByRole("link", { name: "Goals", exact: true }).click();
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

  // Monthly budget, split across categories
  await page.getByRole("link", { name: "Budget", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Food & Toiletries" }).fill("4000");
  await page.getByRole("spinbutton", { name: "Cats" }).fill("800");
  await page.getByRole("spinbutton", { name: "Gas" }).fill("1200");
  await page.getByRole("button", { name: "Save budget" }).click();
  await expect(page.getByText("✓ Saved")).toBeVisible();

  const addExpense = async (category: string, amount: string, description: string) => {
    const chip = page.getByRole("radio", { name: category });
    await page.locator("label").filter({ has: chip }).click(); // the visible chip
    await expect(chip).toBeChecked();
    await page.getByLabel("Amount (R)").fill(amount);
    await page.getByLabel("Note (optional)").fill(description);
    await page.getByRole("button", { name: "Add expense" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: description })).toBeVisible();
  };
  await addExpense("Food & Toiletries", "450", "Checkers run");
  await addExpense("Cats", "300", "Cat food");
  await addExpense("Gifts", "99", "Mistake");

  // The pie tallies each category; the total sits in its centre.
  const pie = page.getByRole("img", { name: /Food & Toiletries R 450, Cats R 300, Gifts R 99/ });
  await expect(pie).toBeVisible();
  await expect(page.getByRole("row", { name: /Cats/ })).toContainText("of R 800");

  // Deleting an expense takes two clicks.
  const mistake = page.getByRole("listitem").filter({ hasText: "Mistake" });
  await mistake.getByRole("button", { name: "Delete expense" }).click();
  await mistake.getByRole("button", { name: "Confirm: Delete expense" }).click();
  await expect(mistake).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Food & Toiletries R 450, Cats R 300" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Budget spent" })).toHaveAttribute(
    "aria-valuenow",
    "13", // R750 of R6 000
  );

  // Money meeting
  await page.getByRole("link", { name: "Meetings", exact: true }).click();
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
  await page.getByRole("link", { name: "Household" }).first().click();
  await page.getByRole("button", { name: "Back up now" }).click();
  await expect(page.getByText("✓ Saved a backup")).toBeVisible();
  await expect(page.getByRole("link", { name: "Download" }).first()).toBeVisible();
  const joinCode = (await page.getByLabel("Join code").textContent())?.trim() ?? "";
  expect(joinCode).toMatch(/^[A-Z0-9]{6}$/);

  const partnerContext = await browser.newContext();
  const partner = await partnerContext.newPage();
  await partner.goto("/register");
  await partner.getByRole("link", { name: "Join a household" }).click();
  await expect(partner).toHaveURL(/\?join/);
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
  await partner.getByRole("link", { name: "Household" }).first().click();
  await expect(partner.getByText("Aid", { exact: true })).toBeVisible();
  await partnerContext.close();
});
