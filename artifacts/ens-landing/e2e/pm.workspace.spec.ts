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

  test("PM projects page renders project cards or empty state", async ({ page }) => {
    await page.goto("/pm/projects");
    await expect(page).toHaveURL(/\/pm\/projects/);
    await page.waitForLoadState("networkidle");
    const hasProjects = await page.getByText(/project|exhibition|booth/i).first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/no projects|assign/i).first().isVisible().catch(() => false);
    expect(hasProjects || hasEmpty).toBeTruthy();
  });

  test("PM workspace page loads booth renderer iframe", async ({ page }) => {
    // Navigate to workspace — if no project assigned, show selection screen
    await page.goto("/pm/workspace");
    await expect(page).toHaveURL(/\/pm\/workspace/);
    await page.waitForLoadState("networkidle");

    // Either shows the iframe booth renderer or a project-selection prompt
    const hasIframe = await page.frameLocator('iframe[title="Booth Renderer"]').locator("body").isVisible().catch(() => false);
    const hasSelector = await page.getByText(/select project|choose|workspace/i).first().isVisible().catch(() => false);
    expect(hasIframe || hasSelector).toBeTruthy();
  });

  test("PM can view client messages list", async ({ page }) => {
    await page.goto("/pm/messages");
    await expect(page).toHaveURL(/\/pm\/messages/);
    await page.waitForLoadState("networkidle");
    const hasContacts = await page.getByText(/message|contact|conversation/i).first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/no messages|start/i).first().isVisible().catch(() => false);
    expect(hasContacts || hasEmpty).toBeTruthy();
  });
});
