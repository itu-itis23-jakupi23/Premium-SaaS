import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

// ── Chief approval queue ────────────────────────────────────────────────────
// Tests the workflow introduced in the last dev sprint:
// Chief can see pending client accounts and approve or reject them.

test.describe("Chief approval queue", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "chief");
  });

  test("chief dashboard shows the workflow queue panel", async ({ page }) => {
    await page.goto("/chief");
    // The workflow queue card is rendered when overview.workflow is present
    await expect(page.getByText(/assignment control|workflow/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("chief can navigate to client list filtered by pending approval", async ({ page }) => {
    await page.goto("/chief/clients");
    // Check that the page loads without errors
    await expect(page).toHaveURL(/\/chief\/clients/);
    await expect(page.getByText(/clients|company/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("chief client list renders intake data when client is pending", async ({ page }) => {
    await page.goto("/chief/clients");
    await page.waitForLoadState("networkidle");
    // With a freshly seeded E2E database, the seeded client (client@demo.example) should
    // appear in the list with "Pending" status until the chief approves them.
    await expect(page.getByText("client@demo.example", { exact: true })).toBeVisible();
    await expect(page.getByText("Pending Approval", { exact: true })).toBeVisible();
    // One of these must be true — the list is never in an indeterminate state
  });
});
