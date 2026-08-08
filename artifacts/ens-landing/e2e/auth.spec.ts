import { test, expect } from "@playwright/test";
import { clientUrl, grantStaffAccess, seedE2EAccounts, TEST_CREDS } from "./helpers";

// ── Login flow ──────────────────────────────────────────────────────────────

test.describe("Staff onboarding", () => {
  test.beforeEach(async ({ page }) => {
    await grantStaffAccess(page);
  });

  test("PM signup requires a Chief invitation and never asks for a company name", async ({ page }) => {
    await page.goto("/signup");

    await expect(page.getByRole("heading", { name: "Join as a Project Manager" })).toBeVisible();
    await expect(page.getByLabel("Invitation link or code")).toBeVisible();
    await expect(page.getByLabel("Company")).toHaveCount(0);
  });

  test("Chief signup creates a new company", async ({ page }) => {
    await page.goto("/signup");
    await page.getByTestId("button-role-chief").click();

    await expect(page.getByRole("heading", { name: "Create Chief Manager account" })).toBeVisible();
    await expect(page.getByLabel("Company")).toBeVisible();
  });

  test("legacy invitation URLs open the public PM join route", async ({ page }) => {
    await page.goto("/signup?invite=legacy-invitation-token");

    await expect(page).toHaveURL(/\/pm\/join\?token=legacy-invitation-token$/);
    await expect(page.getByText(/validating invitation|invitation/i).first()).toBeVisible();
  });
});

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
    await page.waitForURL((url) => url.pathname === "/chief");
    await expect(page.getByRole("heading", { name: /chief dashboard/i })).toBeVisible();
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

  test("PM calendar shows Chief-assigned exhibitions without unauthorized edit controls", async ({ page }) => {
    await grantStaffAccess(page);
    await page.goto("/login");
    await page.getByTestId("input-email").fill(TEST_CREDS.pm.email);
    await page.getByTestId("input-password").fill(TEST_CREDS.pm.password);
    await page.getByTestId("button-login").click();
    await page.waitForURL(/\/pm/);

    await page.goto("/pm/calendar");
    await expect(page.getByTestId("pm-calendar-assigned-only")).toBeVisible();
    await expect(page.getByRole("button", { name: /add event|add to day/i })).toHaveCount(0);
  });

  test("client login shows pending project before Chief assignment", async ({ page }) => {
    await page.goto(clientUrl("/login"));
    await page.getByTestId("input-email").fill(TEST_CREDS.client.email);
    await page.getByTestId("input-password").fill(TEST_CREDS.client.password);
    await page.getByTestId("button-login").click();
    await page.waitForURL(/\/client/);
    await expect(page.getByText("Waiting for Chief assignment", { exact: true })).toBeVisible();
    await expect(page.getByText("Workspace locked until assignment", { exact: true })).toBeVisible();
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
    await page.waitForURL((url) => url.pathname === "/chief");
    await expect(page.getByRole("heading", { name: /chief dashboard/i })).toBeVisible();

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

  test("expired staff session refreshes once and redirects without a render loop", async ({ page, context }) => {
    await grantStaffAccess(page);
    await page.goto("/login");
    await page.getByTestId("input-email").fill(TEST_CREDS.chief.email);
    await page.getByTestId("input-password").fill(TEST_CREDS.chief.password);
    await page.getByTestId("button-login").click();
    await page.waitForURL((url) => url.pathname === "/chief");
    await expect(page.getByRole("heading", { name: /chief dashboard/i })).toBeVisible();

    const refreshResponses: number[] = [];
    const runtimeErrors: string[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/api/auth/refresh")) refreshResponses.push(response.status());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && /maximum update depth/i.test(message.text())) {
        runtimeErrors.push(message.text());
      }
    });

    await context.clearCookies();
    await page.locator('a[href="/chief/clients"]').click();

    await page.waitForURL(/\/login\?returnTo=%2Fchief%2Fclients$/);
    await page.waitForTimeout(250);
    expect(refreshResponses).toEqual([401]);
    expect(runtimeErrors).toEqual([]);
  });

  test("missing access cookie uses one refresh and keeps the staff session", async ({ page, context }) => {
    await grantStaffAccess(page);
    await page.goto("/login");
    await page.getByTestId("input-email").fill(TEST_CREDS.chief.email);
    await page.getByTestId("input-password").fill(TEST_CREDS.chief.password);
    await page.getByTestId("button-login").click();
    await page.waitForURL((url) => url.pathname === "/chief");
    await expect(page.getByRole("heading", { name: /chief dashboard/i })).toBeVisible();

    const refreshCookie = (await context.cookies()).find((cookie) => cookie.name === "ens_refresh");
    expect(refreshCookie).toBeDefined();
    await context.clearCookies();
    await context.addCookies([refreshCookie!]);

    const refreshResponses: number[] = [];
    const runtimeErrors: string[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/api/auth/refresh")) refreshResponses.push(response.status());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && /maximum update depth/i.test(message.text())) {
        runtimeErrors.push(message.text());
      }
    });

    const refreshResponsePromise = page.waitForResponse((response) => (
      response.url().includes("/api/auth/refresh")
    ));
    await page.evaluate("import('/src/lib/platform-api.ts').then((module) => module.getPlatformOverview())");
    const refreshResponse = await refreshResponsePromise;

    expect(refreshResponse.status()).toBe(200);
    expect((await context.cookies()).some((cookie) => cookie.name === "ens_access")).toBe(true);
    await page.locator('a[href="/chief/clients"]').click();
    await page.waitForURL((url) => url.pathname === "/chief/clients");
    await expect(page.getByRole("heading", { name: /clients/i }).first()).toBeVisible();
    await page.waitForTimeout(250);
    expect(refreshResponses).toEqual([200]);
    expect(runtimeErrors).toEqual([]);
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
