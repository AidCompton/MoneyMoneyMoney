import { test, expect } from "@playwright/test";

// A partner joining from their phone. Scripts are switched off for them, the
// way a phone sees the page when they don't load (for example `npm run dev`
// opened from another device), so joining has to work with plain forms and links.

test("a partner joins with the join link, even without JavaScript", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();

  await page.goto("/register");
  await page.getByLabel("Household name").fill("The Join Test");
  await page.getByLabel("Your name").fill("Aid");
  await page.getByLabel("Email").fill(`join-owner-${stamp}@example.com`);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create household" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/household");
  const code = (await page.getByLabel("Join code").textContent())?.trim() ?? "";
  const link = (await page.getByLabel("Join link", { exact: true }).textContent())?.trim() ?? "";
  expect(link).toMatch(new RegExp(`/register\\?code=${code}$`));
  await expect(page.getByRole("img", { name: "QR code for the join link" })).toBeVisible();

  const partnerContext = await browser.newContext({ javaScriptEnabled: false });
  const partner = await partnerContext.newPage();

  // The tab is a plain link.
  await partner.goto("/register");
  await partner.getByRole("link", { name: "Join a household" }).click();
  await expect(partner.getByLabel("Join code")).toBeVisible();

  // A wrong code says so.
  await partner.getByLabel("Join code").fill("ZZZZZZ");
  await partner.getByLabel("Your name").fill("Sam");
  await partner.getByLabel("Email").fill(`join-partner-${stamp}@example.com`);
  await partner.getByLabel("Password").fill("password123");
  await partner.getByRole("button", { name: "Join household" }).click();
  await expect(partner.getByRole("alert")).toHaveText(/couldn.t find a household with that code/);

  // The join link fills in the code.
  await partner.goto(new URL(link).pathname + new URL(link).search);
  await expect(partner.getByLabel("Join code")).toHaveValue(code);
  await partner.getByLabel("Your name").fill("Sam");
  await partner.getByLabel("Email").fill(`join-partner-${stamp}@example.com`);
  await partner.getByLabel("Password").fill("password123");
  await partner.getByRole("button", { name: "Join household" }).click();
  await expect(partner).toHaveURL(/\/dashboard/);

  await partner.goto("/household");
  await expect(partner.getByText("Aid", { exact: true })).toBeVisible();
  await expect(partner.getByText(`join-partner-${stamp}@example.com`)).toBeVisible();
  await partnerContext.close();
});
