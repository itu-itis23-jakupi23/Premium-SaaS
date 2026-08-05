import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

// ── PM workspace flow ───────────────────────────────────────────────────────

test.describe("PM workspace", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "pm");
  });

  test("PM dashboard loads without JavaScript errors", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.goto("/pm");
    await page.waitForLoadState("networkidle");

    // Filter out known non-critical warnings
    const realErrors = jsErrors.filter((e) =>
      !e.includes("ResizeObserver") && !e.includes("Non-passive") && !e.includes("404"),
    );
    expect(realErrors).toHaveLength(0);
  });

  test("PM projects page shows the exact empty state", async ({ page }) => {
    await page.goto("/pm/projects");
    await expect(page).toHaveURL(/\/pm\/projects/);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("No projects match your filter.", { exact: true }).first()).toBeVisible();
  });

  test("PM workspace does not create a renderer without an assigned project", async ({ page }) => {
    // Navigate to workspace — if no project assigned, show selection screen
    await page.goto("/pm/workspace");
    await expect(page).toHaveURL(/\/pm\/workspace/);
    await page.waitForLoadState("networkidle");

    // Either shows the iframe booth renderer or a project-selection prompt
    await expect(page.locator('iframe[title="Booth Renderer"]')).toHaveCount(0);
    await expect(page.getByText(/no assigned projects|select.*project/i).first()).toBeVisible();
  });

  test("PM can view client messages list", async ({ page }) => {
    await page.goto("/pm/messages");
    await expect(page).toHaveURL(/\/pm\/messages/);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("General", { exact: true })).toBeVisible();
    await expect(page.getByText("Chief", { exact: true })).toBeVisible();
    await expect(page.getByText("Select an exhibition", { exact: true }).last()).toBeVisible();
  });
});
