import { expect, test } from "@playwright/test";
import { grantStaffAccess } from "./helpers";

/**
 * Arabic, checked by measuring the page rather than reading the markup.
 *
 * The app does RTL with explicit conditionals - the locale sets
 * `documentElement.dir`, and DashboardLayout flips the sidebar, the chevrons
 * and the gutter padding on `isRtl` - rather than with logical CSS. Counting
 * `text-left` in the source says little about that: most elements set no
 * alignment at all and inherit the direction correctly. Only the rendered
 * page can say which ones actually come out wrong.
 *
 * Measured here first: of 72 text-bearing elements, two were left-aligned in
 * an RTL document, both in the signed-in account block, because a wrapper
 * carried `text-left`. This keeps that at zero, and the count is the point -
 * a new `text-left` on a page that Arabic users read is exactly what this is
 * meant to catch.
 */
test("the staff shell and the loading sheet read right-to-left in Arabic", async ({ page }) => {
  const showName = "Chief Fixture Expo";
  const unexpected: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await grantStaffAccess(page);
  await page.addInitScript(() => localStorage.setItem("ens-lang", "ar"));
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

  await page.goto("/chief/extras");
  await page.getByTestId(`extras-show-${showName}`).click();
  await expect(page.locator(".extras-sheet")).toBeVisible();

  const layout = await page.evaluate(() => {
    const misaligned: string[] = [];
    let textBearing = 0;
    document.querySelectorAll("*").forEach((node) => {
      const el = node as HTMLElement;
      const style = getComputedStyle(el);
      if (style.direction !== "rtl") return;
      // Only elements holding their own text: a wrapper inherits alignment,
      // so flagging it would report the same offence many times over.
      const ownText = [...el.childNodes].some(
        (child) => child.nodeType === 3 && (child.textContent || "").trim().length > 1,
      );
      if (!ownText) return;
      textBearing += 1;
      if (style.textAlign === "left") {
        misaligned.push(
          `<${el.tagName.toLowerCase()} class="${(el.className || "").toString().slice(0, 60)}">`,
        );
      }
    });
    const aside = document.querySelector("aside");
    return {
      documentDirection: document.documentElement.dir,
      textBearing,
      misaligned,
      sidebarLeft: aside ? Math.round(aside.getBoundingClientRect().left) : null,
      viewportWidth: window.innerWidth,
    };
  });

  expect(layout.documentDirection, "the locale sets the document direction").toBe("rtl");
  expect(layout.textBearing, "the page must actually have rendered its text").toBeGreaterThan(20);

  // The navigation moves to the other edge, which is the visible half of RTL
  // and the half a reader notices immediately if it breaks.
  expect(
    layout.sidebarLeft,
    `the sidebar should sit on the right in Arabic, found at x=${layout.sidebarLeft} of ${layout.viewportWidth}`,
  ).toBeGreaterThan(layout.viewportWidth / 2);

  expect(
    layout.misaligned,
    `these hold text and stay left-aligned in a right-to-left document: `
      + layout.misaligned.join(" | "),
  ).toEqual([]);

  expect(unexpected, "No requests may leave this isolated fixture").toEqual([]);
  expect(pageErrors).toEqual([]);
});
