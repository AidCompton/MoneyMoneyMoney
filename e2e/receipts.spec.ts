import { test, expect } from "@playwright/test";

// Receipt scanning, read on this computer: the quick-add page (what Back Tap
// opens), a photo read into a store, date, total and items, saving it as a
// shared expense, the receipt page, and the second scan remembering the lines.

test("scan a receipt from quick add", async ({ page }) => {
  test.setTimeout(180_000);
  const stamp = Date.now();

  await page.goto("/register");
  await page.getByLabel("Household name").fill("The Receipt Test");
  await page.getByLabel("Your name").fill("Aid");
  await page.getByLabel("Email").fill(`receipts-${stamp}@example.com`);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create household" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: "Quick add an expense" }).click();
  await expect(page).toHaveURL(/\/add/);

  await page.getByLabel("Choose a receipt photo").setInputFiles("e2e/fixtures/receipt.jpg");
  await expect(page.getByText("Everything checks out")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("#receipt-store-input")).toHaveValue("Checkers");
  await expect(page.locator("#receipt-date-input")).toHaveValue("2026-09-25");
  await expect(page.locator("#receipt-total-input")).toHaveValue("227.45");
  await expect(page.getByText("Receipt says “KOO BAKED BEANS”")).toBeVisible();

  await page.getByRole("button", { name: "Save R 227.45" }).click();
  await expect(page.getByText("Saved R 227.45 at Checkers")).toBeVisible();

  await page.getByRole("link", { name: "View receipt" }).click();
  await expect(page).toHaveURL(/\/receipts\/.+/);
  await expect(page.getByRole("heading", { name: "Checkers" })).toBeVisible();
  await expect(page.getByText("Fresh Chicken Fillets", { exact: true })).toBeVisible();
  await expect(page.getByText("2 × R 14.99")).toBeVisible();

  // The same lines again are filled in from last time.
  await page.goto("/add");
  await page.getByLabel("Choose a receipt photo").setInputFiles("e2e/fixtures/receipt.jpg");
  await expect(page.getByText("Everything checks out")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Filled in from last time").first()).toBeVisible();
});
