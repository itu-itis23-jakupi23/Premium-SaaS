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

  test("client login lands on the client dashboard or pending screen", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_CREDS.client.email);
    await page.getByLabel(/password/i).fill(TEST_CREDS.client.password);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/client/);
    // Either shows the real dashboard or the pending-approval holding screen
    const hasDashboard = await page.getByText(/dashboard|projects|workspace/i).first().isVisible().catch(() => false);
    const hasPending = await page.getByText(/pending approval|waiting/i).first().isVisible().catch(() => false);
    expect(hasDashboard || hasPending).toBeTruthy();
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
});
