import { test, expect } from "@playwright/test";
import { TEST_CREDS } from "./helpers";

// ── Login flow ──────────────────────────────────────────────────────────────

test.describe("Authentication", () => {
  test("chief login lands on the chief dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_CREDS.chief.email);
    await page.getByLabel(/password/i).fill(TEST_CREDS.chief.password);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/chief/);
    // The chief dashboard should be visible
    await expect(page.getByText(/chief|dashboard|projects/i).first()).toBeVisible();
  });

  test("PM login lands on the PM dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_CREDS.pm.email);
    await page.getByLabel(/password/i).fill(TEST_CREDS.pm.password);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/pm/);
    await expect(page.getByText(/project manager|pm|dashboard/i).first()).toBeVisible();
  });

  test("client login shows pending approval before Chief approval", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_CREDS.client.email);
    await page.getByLabel(/password/i).fill(TEST_CREDS.client.password);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/client/);
    await expect(page.getByRole("heading", { name: "Pending Approval" })).toBeVisible();
  });

  test("wrong password shows an error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_CREDS.chief.email);
    await page.getByLabel(/password/i).fill("definitely-wrong-password");
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    // Should stay on login page and show an error
    await expect(page).toHaveURL(/login/);
    await expect(page.getByText(/incorrect|invalid|wrong|failed/i)).toBeVisible();
  });

  test("logout redirects to login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_CREDS.chief.email);
    await page.getByLabel(/password/i).fill(TEST_CREDS.chief.password);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/chief/);

    // Open user menu or find logout button
    const logoutButton = page.getByRole("button", { name: /log out|sign out/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else {
      // Try via navigation menu
      const menuButton = page.getByRole("button", { name: /menu|avatar|account/i }).first();
      await menuButton.click();
      await page.getByText(/log out|sign out/i).click();
    }
    await page.waitForURL(/login/);
    await expect(page).toHaveURL(/login/);
  });

  test("PM cannot open Chief routes", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_CREDS.pm.email);
    await page.getByLabel(/password/i).fill(TEST_CREDS.pm.password);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/pm/);

    await page.goto("/chief/clients");
    await page.waitForURL(/\/pm/);
    await expect(page).not.toHaveURL(/\/chief/);
  });

  test("Chief cannot open PM-only routes", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_CREDS.chief.email);
    await page.getByLabel(/password/i).fill(TEST_CREDS.chief.password);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/chief/);

    await page.goto("/pm/tasks");
    await page.waitForURL(/\/chief/);
    await expect(page).not.toHaveURL(/\/pm/);
  });
});
