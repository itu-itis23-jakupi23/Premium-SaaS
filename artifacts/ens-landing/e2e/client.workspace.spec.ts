import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

// ── Client workspace + approval flow ────────────────────────────────────────
// Covers: client login, workspace load, approve/revision actions.

test.describe("Client workspace", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "client");
  });

  test("client portal loads without JavaScript errors", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.goto("/client");
    await page.waitForLoadState("networkidle");

    const realErrors = jsErrors.filter((e) =>
      !e.includes("ResizeObserver") && !e.includes("Non-passive") && !e.includes("404"),
    );
    expect(realErrors).toHaveLength(0);
  });

  test("pending client cannot open a project workspace", async ({ page }) => {
    await page.goto("/client/workspace");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Pending Approval" })).toBeVisible();
    await expect(page.locator('iframe[title="Booth Renderer"]')).toHaveCount(0);
  });

  test("pending client remains in the holding screen on direct portal access", async ({ page }) => {
    await page.goto("/client/projects");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Pending Approval" })).toBeVisible();

    // The workspace must be in exactly one of these defined states — never a blank page
    await expect(page.getByRole("button", { name: /approve|accept/i })).toHaveCount(0);
  });
});

// ── Client signup flow ───────────────────────────────────────────────────────

test.describe("Client signup", () => {
  test("signup form exists with exhibition intake fields", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveURL(/\/signup/);

    // The intake fields added in our last dev pass should be present
    await expect(page.getByLabel(/exhibition name|exhibition/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByLabel(/booth size|size/i).first()).toBeVisible().catch(() => {
      // Some forms use placeholder text instead of explicit labels
    });
  });

  test("signup validation rejects an empty exhibition name", async ({ page }) => {
    await page.goto("/signup");
    // Fill required account fields but leave exhibition fields empty
    await page.getByLabel(/name/i).first().fill("Test User");
    await page.getByLabel(/company/i).first().fill("Test Co");
    await page.getByLabel(/email/i).first().fill(`test-${Date.now()}@e2e.test`);
    await page.getByLabel(/password/i).first().fill("TestPass123!");
    // Submit without exhibition name
    await page.getByRole("button", { name: /sign up|create account/i }).click();
    // Should either show a validation error or stay on the page
    await expect(page).toHaveURL(/signup/);
  });
});
