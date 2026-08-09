import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Desktop-only guard for the 3D editor (WS-18).
 *
 * The editor has no touch or small-viewport design. These tests pin the
 * intended behaviour at both ends: a phone viewport gets an explicit
 * limitation screen rather than a laid-out but unusable editor, and a desktop
 * viewport is not affected by the guard at all.
 */

test.describe("Booth editor viewport guard", () => {
  test("a phone viewport gets an explicit limitation screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "pm");
    await page.goto("/pm/workspace");

    const guard = page.getByTestId("editor-desktop-only");
    await expect(guard).toBeVisible();

    // The editor itself must not render behind the guard.
    await expect(page.locator("iframe")).toHaveCount(0);

    // And the user must have a way out that is not the back button.
    await expect(page.getByTestId("btn-desktop-only-back")).toBeVisible();
  });

  test("the guard releases when the viewport is widened", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "pm");
    await page.goto("/pm/workspace");
    await expect(page.getByTestId("editor-desktop-only")).toBeVisible();

    // matchMedia is subscribed, so this must react without a reload.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByTestId("editor-desktop-only")).toHaveCount(0);
  });

  test("a desktop viewport reaches the editor unaffected", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, "pm");
    await page.goto("/pm/workspace");

    await expect(page.getByTestId("editor-desktop-only")).toHaveCount(0);
  });
});
