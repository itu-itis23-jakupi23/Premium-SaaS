import { expect, test } from "@playwright/test";
import { grantStaffAccess } from "./helpers";

/**
 * The chief reaches the furniture lists from their own sidebar.
 *
 * The page began life as a project manager's, at /pm/extras, behind
 * `allowedRoles={["pm"]}` - so a chief could not open it at all, which is
 * the wrong way round: the chief is who signs off what leaves the warehouse.
 * It is now a shared staff page bound to both sections, like Quotes and
 * Invoices.
 *
 * Worth its own test because the two halves fail independently and both fail
 * quietly: a route the guard rejects redirects rather than erroring, and a
 * missing sidebar entry leaves a page that exists and cannot be found.
 */
test("a chief opens the furniture lists from their own navigation", async ({ page }) => {
  const showName = "Chief Fixture Expo";
  const unexpected: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await grantStaffAccess(page);
  await page.addInitScript(() => localStorage.setItem("ens-lang", "en"));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (request.method() === "GET") {
      if (path === "/api/auth/me") return route.fulfill({ json: {
        user: { id: "00000000-0000-4000-8000-000000000201", name: "Fixture Chief", email: "chief@example.test", role: "chief", systemRole: "chief" },
        organization: { id: "00000000-0000-4000-8000-000000000001", name: "Fixture Agency", slug: "fixture-agency", plan: "starter" }, clientRecord: null,
      } });
      if (path === "/api/platform/account/settings") return route.fulfill({ json: { profile: { name: "Fixture Chief", email: "chief@example.test", avatarUrl: "" } } });
      if (path === "/api/platform/notifications") return route.fulfill({ json: { notifications: [], unread: 0 } });
      if (path === "/api/platform/extras/shows") return route.fulfill({ json: { shows: [
        { name: showName, venue: "Fixture Hall", city: "Istanbul", boothCount: 2 },
      ] } });
      if (path === "/api/platform/extras/furniture-manifest") return route.fulfill({ json: {
        exhibition: { name: showName, venue: "Fixture Hall", city: "Istanbul", country: "Turkey" },
        booths: [
          { projectId: "00000000-0000-4000-8000-000000000401", projectName: "Stand One", clientName: "Client One", standNumber: "A-1", items: [
            { sku: "309", name: "Fixture Leather Chair", qty: 2 },
          ] },
          { projectId: "00000000-0000-4000-8000-000000000402", projectName: "Stand Two", clientName: "Client Two", standNumber: "B-2", items: [
            { sku: "309", name: "Fixture Leather Chair", qty: 4 },
          ] },
        ],
        totals: { booths: 2, items: 6 },
      } });
    }
    unexpected.push(`${request.method()} ${path}`);
    return route.abort("blockedbyclient");
  });

  // Straight to the page: the chief dashboard fetches a good deal more than
  // this fixture answers, and blocking those would be noise about a screen
  // this test is not making a claim about.
  await page.goto("/chief/extras");

  // The guard admits a chief rather than bouncing them to their dashboard.
  await expect(page).toHaveURL(/\/chief\/extras$/);

  // And the sidebar on this very page is how it is found in the first place.
  await expect(
    page.locator('a[href="/chief/extras"]').first(),
    "the chief sidebar offers the furniture lists",
  ).toBeVisible();

  await page.getByTestId(`extras-show-${showName}`).click();
  const sheet = page.locator(".extras-sheet");
  await expect(sheet).toBeVisible();

  /**
   * The chief's reason for opening it: one number for the whole show. Six
   * chairs across two stands, aggregated - not two rows of two and four.
   */
  const pullList = sheet.locator(".extras-pull");
  await expect(pullList.locator("tbody tr")).toHaveCount(1);
  await expect(pullList.locator("tbody tr td.extras-total")).toHaveText("6");
  await expect(pullList).toContainText("Fixture Leather Chair");

  // And both ways of printing it are offered here too.
  await expect(page.getByTestId("extras-print-warehouse")).toBeVisible();
  await expect(page.getByTestId("extras-print")).toBeVisible();
  await expect(page.getByTestId("extras-send-chief")).toBeVisible();

  expect(unexpected, "No requests may leave this isolated fixture").toEqual([]);
  expect(pageErrors).toEqual([]);
});
