import { expect, test } from "@playwright/test";
import { grantStaffAccess } from "./helpers";

test("the Extras sheet prints with controls hidden and leaves other routes printable", async ({ page }) => {
  const showName = "Fixture Loading Expo";
  const unexpected: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await grantStaffAccess(page);
  await page.addInitScript(() => localStorage.setItem("ens-lang", "en"));
  // This fixture fulfils every API read and blocks all unexpected traffic.
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (request.method() === "GET") {
      if (path === "/api/auth/me") return route.fulfill({ json: {
        user: { id: "00000000-0000-4000-8000-000000000101", name: "Print Fixture PM", email: "print.pm@example.test", role: "pm", systemRole: "pm" },
        organization: { id: "00000000-0000-4000-8000-000000000001", name: "Fixture Agency", slug: "fixture-agency", plan: "starter" }, clientRecord: null,
      } });
      if (path === "/api/platform/account/settings") return route.fulfill({ json: { profile: { name: "Print Fixture PM", email: "print.pm@example.test", avatarUrl: "" } } });
      if (path === "/api/platform/notifications") return route.fulfill({ json: { notifications: [], unread: 0 } });
      if (path === "/api/platform/extras/shows") return route.fulfill({ json: { shows: [
        { name: showName, venue: "Fixture Hall", city: "Istanbul", boothCount: 1 },
      ] } });
      if (path === "/api/platform/extras/furniture-manifest" && new URL(request.url()).searchParams.get("show") === showName) return route.fulfill({ json: {
        exhibition: { name: showName, venue: "Fixture Hall", city: "Istanbul", country: "Turkey" },
        booths: [{ projectId: "00000000-0000-4000-8000-000000000401", projectName: "Fixture Stand", clientName: "Fixture Client", standNumber: "A12", items: [{ sku: "CHAIR-1", name: "Fixture Paper Chair", qty: 3 }] }],
        totals: { booths: 1, items: 3 },
      } });
      if (path === "/api/platform/clients") return route.fulfill({ json: {
        clients: [], pagination: { total: 0, limit: 25, offset: 0, hasMore: false }, summary: { total: 0, active: 0, needsSetup: 0 },
      } });
    }
    unexpected.push(`${request.method()} ${path}`);
    return route.abort("blockedbyclient");
  });

  await page.goto("/pm/extras");
  await page.getByTestId(`extras-show-${showName}`).click();
  const sheet = page.locator(".extras-sheet");
  const pullList = sheet.locator(".extras-pull");
  const standList = sheet.locator(".extras-booth");
  await expect(standList.getByText("Fixture Paper Chair", { exact: true })).toBeVisible();

  /**
   * The warehouse total, which is the number somebody counts onto a van.
   *
   * The fixture puts three chairs on one stand, so the pull list must say
   * three. An aggregate that silently counted rows rather than pieces would
   * say one and still look like a working page.
   */
  await expect(pullList.getByText("Fixture Paper Chair", { exact: true })).toBeVisible();
  await expect(pullList.locator("tbody tr")).toHaveCount(1);
  await expect(pullList.locator("tbody tr td.extras-total")).toHaveText("3");
  await expect(page.getByTestId("extras-print")).toBeVisible();
  await page.emulateMedia({ media: "print" });

  /**
   * Sampled once, immediately, and deliberately not retried.
   *
   * `toHaveCSS` polls until a value settles, which is exactly wrong here. The
   * content column reserves the fixed sidebar's width as left padding and
   * carries `transition-all duration-300`, so that padding *animates* to zero
   * when print styles apply rather than dropping there. A retrying assertion
   * waits the animation out and passes while real printed pages carry a 260px
   * blank strip down the left - which is what shipped, and what measuring the
   * first frame rather than the settled one revealed. dashboard-print.css
   * suppresses transitions for print; this is what holds it in place.
   */
  const gutterAtPrintTime = await page.evaluate(() => {
    const column = document.querySelector("main")?.parentElement;
    return column ? getComputedStyle(column).paddingLeft : null;
  });
  expect(
    gutterAtPrintTime,
    "the sidebar gutter must be gone the instant print styles apply, not 300ms later",
  ).toBe("0px");

  // A loading list is marked up with a pen and printed in volume, so it prints
  // black. The app's body ink is tinted and survived into the sheet.
  const itemInk = await page.evaluate(() => {
    const cell = document.querySelector(".extras-table td:nth-child(3)");
    return cell ? getComputedStyle(cell).color : null;
  });
  expect(itemInk, "the loading sheet prints in black ink").toBe("rgb(0, 0, 0)");

  await expect(sheet).toBeVisible();
  await expect(standList.getByText("Fixture Paper Chair", { exact: true })).toBeVisible();
  await expect(page.getByTestId("extras-print")).toBeHidden();
  await expect(page.getByTestId(`extras-show-${showName}`)).toBeHidden();
  await expect(page.locator(".extras-layout")).toHaveCSS("display", "block");
  await expect(sheet).toHaveCSS("page", "pm-extras-sheet");
  await expect(sheet).toHaveCSS("padding", "0px");
  await expect(sheet).toHaveCSS("break-inside", "auto");
  // Both tables repeat their header on every page they span.
  await expect(standList.locator("thead")).toHaveCSS("display", "table-header-group");
  await expect(pullList.locator("thead")).toHaveCSS("display", "table-header-group");

  /**
   * The two sheets are one document on screen and two jobs on paper.
   *
   * `window.print()` is stubbed because the print dialog is modal and would
   * hang the run; the assertion is on what the page would hand the printer,
   * which is the part that was wrong before these existed. The count at the
   * end proves the buttons actually printed rather than only restyling.
   */
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => {
    (window as unknown as { __printCalls: number }).__printCalls = 0;
    window.print = () => { (window as unknown as { __printCalls: number }).__printCalls += 1; };
  });

  await page.getByTestId("extras-print-warehouse").click();
  await page.emulateMedia({ media: "print" });
  await expect(pullList, "the warehouse sheet is the pull list").toBeVisible();
  await expect(standList, "the warehouse sheet carries no stand pages").toBeHidden();

  await page.emulateMedia({ media: "screen" });
  await page.getByTestId("extras-print").click();
  await page.emulateMedia({ media: "print" });
  await expect(standList, "the stand sheet carries the stands").toBeVisible();
  await expect(pullList, "the stand sheet carries no pull list").toBeHidden();

  expect(
    await page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls),
    "both buttons reached the printer",
  ).toBe(2);

  // Navigate in the SPA so the already loaded CSS chunk stays in the browser.
  await page.emulateMedia({ media: "screen" });
  await page.locator('a[href="/pm/clients"]').first().click();
  await expect(page).toHaveURL(/\/pm\/clients$/);
  await expect(page.locator(".pm-extras-page")).toHaveCount(0);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("heading", { name: "My Clients", exact: true })).toBeVisible();
  await expect(page.locator("#root")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("main")).toHaveCSS("page", "auto");
  expect(unexpected, "No requests may leave this isolated fixture").toEqual([]);
  expect(pageErrors).toEqual([]);
});
