import { test, expect } from "@playwright/test";

// Covers the core Money Meeting loop end to end: create a household, log a
// savings contribution, log a grocery expense, and run a meeting with an
// action item. This is the app's whole reason for existing, so it's the one
// flow worth exercising in a real browser rather than just unit tests.

test("register, track a goal, log a budget, run a meeting", async ({ page }) => {
  const email = `test-${Date.now()}@example.com`;

  await page.goto("/register");
  await page.getByLabel("Household name").fill("The Test Household");
  await page.getByLabel("Your name").fill("Aid");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create household" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  // Savings goal
  await page.getByRole("link", { name: "Goals" }).click();
  await page.getByLabel("Goal name").fill("Joint Year-End Goal");
  await page.getByLabel("Target amount (R)").fill("100000");
  await page.getByRole("button", { name: "Create goal" }).click();

  await expect(page).toHaveURL(/\/goals\/.+/);
  await page.getByLabel("Amount (R)").fill("5000");
  await page.getByRole("button", { name: "Add contribution" }).click();
  await expect(page.getByText("R 5 000 of R 100 000")).toBeVisible();

  // Grocery budget
  await page.getByRole("link", { name: "Budget" }).click();
  await page.getByLabel(/Grocery budget for/).fill("6000");
  await page.getByRole("button", { name: "Set budget" }).click();
  await expect(page.getByLabel("Amount (R)")).toBeVisible();
  await page.getByLabel("Amount (R)").fill("450");
  await page.getByLabel("Description").fill("Checkers run");
  await page.getByRole("button", { name: "Log expense" }).click();
  await expect(page.getByText("Checkers run")).toBeVisible();
  await expect(page.getByText("R 5 550 left")).toBeVisible();

  // Money meeting
  await page.getByRole("link", { name: "Money Meetings" }).click();
  await page.getByRole("button", { name: /Start this week's meeting/ }).click();

  await expect(page).toHaveURL(/\/meetings\/.+/);
  await page.getByPlaceholder(/What did you decide/).fill("Agreed to cut takeout spend.");
  await page.getByRole("button", { name: "Save notes" }).click();

  await page.getByLabel("Action item").fill("Move R2000 to savings");
  await page.getByRole("button", { name: "Add action item" }).click();
  await expect(page.getByText("Move R2000 to savings")).toBeVisible();

  await page.getByRole("button", { name: "Mark as done" }).click();
  await expect(page.getByText("Move R2000 to savings")).toHaveClass(/line-through/);
});
