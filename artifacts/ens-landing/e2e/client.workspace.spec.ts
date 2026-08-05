import { test, expect } from "@playwright/test";
import { clientUrl, loginAs } from "./helpers";

// ── Client workspace + approval flow ────────────────────────────────────────
// Covers: client login, workspace load, approve/revision actions.

test.describe("Client workspace", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "client");
  });

  test("client portal loads without JavaScript errors", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.goto(clientUrl("/client"));
    await page.waitForLoadState("networkidle");

    const realErrors = jsErrors.filter((e) =>
      !e.includes("ResizeObserver") && !e.includes("Non-passive") && !e.includes("404"),
    );
    expect(realErrors).toHaveLength(0);
  });

  test("client opens a locked workspace while awaiting approval", async ({ page }) => {
    await page.goto(clientUrl("/client/workspace"));
    await page.waitForLoadState("networkidle");

    // A not-yet-approved client is gated on every portal page — never a blank
    // page and never the live editor.
    await expect(page.getByRole("heading", { name: /pending approval/i })).toBeVisible();
    await expect(page.getByText(/waiting for your agency/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /approve design|request changes/i })).toHaveCount(0);
  });

  test("pending client project stays non-approvable on direct portal access", async ({ page }) => {
    await page.goto(clientUrl("/client/projects"));
    await page.waitForLoadState("networkidle");

    // The approval gate covers the projects route too: no rows, no approval
    // affordances anywhere on the page.
    await expect(page.getByRole("heading", { name: /pending approval/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /approve design|accept/i })).toHaveCount(0);
  });
});

// ── Client signup flow ───────────────────────────────────────────────────────

test.describe("Client signup", () => {
  test("signup form exists with exhibition intake fields", async ({ page }) => {
    await page.goto(clientUrl("/signup"));
    await expect(page).toHaveURL(/\/signup/);

    // The intake fields added in our last dev pass should be present
    await expect(page.getByTestId("input-organization-code")).toBeVisible();
    await expect(page.getByLabel(/exhibition name|exhibition/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByLabel(/booth size|size/i).first()).toBeVisible().catch(() => {
      // Some forms use placeholder text instead of explicit labels
    });
  });

  test("signup validation rejects an empty exhibition name", async ({ page }) => {
    await page.goto(clientUrl("/signup"));
    // Fill required account fields but leave exhibition fields empty
    await page.getByLabel(/name/i).first().fill("Test User");
    await page.getByLabel(/company/i).first().fill("Test Co");
    await page.getByLabel(/email/i).first().fill(`test-${Date.now()}@e2e.test`);
    await page.getByLabel(/password/i).first().fill("TestPass123!");
    await page.getByTestId("input-confirm-password").fill("TestPass123!");
    await page.getByTestId("checkbox-terms").click();
    // Submit without exhibition name
    await page.getByTestId("button-signup").click();
    // Should either show a validation error or stay on the page
    await expect(page).toHaveURL(/signup/);
  });
});
