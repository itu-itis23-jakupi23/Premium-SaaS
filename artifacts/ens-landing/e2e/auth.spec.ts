import { test, expect } from "@playwright/test";
import { clientUrl, grantStaffAccess, seedE2EAccounts, TEST_CREDS } from "./helpers";

// ── Login flow ──────────────────────────────────────────────────────────────

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await seedE2EAccounts(page);
  });

  test("chief login lands on the chief dashboard", async ({ page }) => {
    await grantStaffAccess(page);
    await page.goto("/login");
    await page.getByTestId("input-email").fill(TEST_CREDS.chief.email);
    await page.getByTestId("input-password").fill(TEST_CREDS.chief.password);
    await page.getByTestId("button-login").click();
    await page.waitForURL(/\/chief/);
    // The chief dashboard should be visible
    await expect(page.getByText(/chief|dashboard|projects/i).first()).toBeVisible();
  });

  test("PM login lands on the PM dashboard", async ({ page }) => {
    await grantStaffAccess(page);
    await page.goto("/login");
    await page.getByTestId("input-email").fill(TEST_CREDS.pm.email);
    await page.getByTestId("input-password").fill(TEST_CREDS.pm.password);
    await page.getByTestId("button-login").click();
    await page.waitForURL(/\/pm/);
    await expect(page.getByText(/project manager|pm|dashboard/i).first()).toBeVisible();
  });

  test("client login shows pending project before Chief assignment", async ({ page }) => {
    await page.goto(clientUrl("/login"));
    await page.getByTestId("input-email").fill(TEST_CREDS.client.email);
    await page.getByTestId("input-password").fill(TEST_CREDS.client.password);
    await page.getByTestId("button-login").click();
    await page.waitForURL(/\/client/);
    await expect(page.getByText("Pending", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Unassigned", { exact: true }).first()).toBeVisible();
  });

  test("wrong password shows an error", async ({ page }) => {
    await grantStaffAccess(page);
    await page.goto("/login");
    await page.getByTestId("input-email").fill(TEST_CREDS.chief.email);
    await page.getByTestId("input-password").fill("definitely-wrong-password");
    await page.getByTestId("button-login").click();
    // Should stay on login page and show an error
    await expect(page).toHaveURL(/login/);
    await expect(page.getByText(/incorrect|invalid|wrong|failed/i)).toBeVisible();
  });

  test("logout redirects to login", async ({ page }) => {
    await grantStaffAccess(page);
    await page.goto("/login");
    await page.getByTestId("input-email").fill(TEST_CREDS.chief.email);
    await page.getByTestId("input-password").fill(TEST_CREDS.chief.password);
    await page.getByTestId("button-login").click();
    await page.waitForURL(/\/chief/);

    // Open user menu or find logout button
    const logoutButton = page.getByRole("button", { name: /logout|log out|sign out/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else {
      // Try via navigation menu
      const menuButton = page.getByRole("button", { name: /menu|avatar|account/i }).first();
      await menuButton.click();
      await page.getByText(/logout|log out|sign out/i).click();
    }
    await page.waitForURL(/login/);
    await expect(page).toHaveURL(/login/);
  });

  test("PM cannot open Chief routes", async ({ page }) => {
    await grantStaffAccess(page);
    await page.goto("/login");
    await page.getByTestId("input-email").fill(TEST_CREDS.pm.email);
    await page.getByTestId("input-password").fill(TEST_CREDS.pm.password);
    await page.getByTestId("button-login").click();
    await page.waitForURL(/\/pm/);

    await page.goto("/chief/clients");
    await page.waitForURL(/\/pm/);
    await expect(page).not.toHaveURL(/\/chief/);
  });

  test("Chief cannot open PM-only routes", async ({ page }) => {
    await grantStaffAccess(page);
    await page.goto("/login");
    await page.getByTestId("input-email").fill(TEST_CREDS.chief.email);
    await page.getByTestId("input-password").fill(TEST_CREDS.chief.password);
    await page.getByTestId("button-login").click();
    await page.waitForURL(/\/chief/);

    await page.goto("/pm/tasks");
    await page.waitForURL(/\/chief/);
    await expect(page).not.toHaveURL(/\/pm/);
  });
});
