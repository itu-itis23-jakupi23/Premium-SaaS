import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * The portal shell has to fit the screen it is on (WS-21).
 *
 * The dashboard shell wraps every page in all three staff/client portals and
 * had five responsive utilities in 689 lines. The failure it produced was not a
 * sideways scrollbar - the page root sets `overflow-x-clip`, so surplus width is
 * not scrolled off, it is *unreachable*. On a portrait tablet the content column
 * measured 946px inside a 768px viewport and every card's action button sat in
 * the missing 178. The page looked fine and could not be operated.
 *
 * That is why this measures `scrollWidth - clientWidth` on the shell root rather
 * than looking for a scrollbar: with clipping on, the scrollbar never appears
 * and the only evidence is the arithmetic.
 *
 * The 3D booth editor is deliberately excluded - see DesktopOnlyGuard, which
 * turns it away below 1024px on purpose.
 */

const SIZES = [
  { name: "phone-390", w: 390, h: 844 },
  { name: "phone-430", w: 430, h: 932 },
  { name: "tablet-768", w: 768, h: 1024 },
  { name: "tablet-1024", w: 1024, h: 768 },
  { name: "laptop-1280", w: 1280, h: 800 },
];

test("no portal clips its content at any device width", async ({ page }) => {
  const failures: string[] = [];

  for (const role of ["pm", "chief", "client"] as const) {
    await loginAs(page, role);
    for (const vp of SIZES) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(`/${role}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);

      const overflow = await page.evaluate(() => {
        const root = document.querySelector("div.flex.min-h-screen") as HTMLElement | null;
        if (!root) return null;
        return root.scrollWidth - root.clientWidth;
      });

      if (overflow === null) {
        failures.push(`${role} ${vp.name}: shell root not found`);
        continue;
      }
      // A couple of pixels is sub-pixel rounding; anything more is content the
      // user cannot get to, because the root clips rather than scrolls.
      if (overflow > 2) failures.push(`${role} ${vp.name}: ${overflow}px unreachable`);
    }
  }

  expect(failures, "content past the viewport edge, clipped and unreachable").toEqual([]);
});

test("the sidebar follows the window instead of the page load", async ({ page }) => {
  // The collapse state was read once at mount, so dragging a window narrower
  // never changed anything - the layout only responded if you reloaded at the
  // new size. It tracks the media query now.
  await loginAs(page, "pm");
  const sidebarWidth = () =>
    page.evaluate(() => Math.round(document.querySelector("aside")!.getBoundingClientRect().width));

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/pm", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  expect(await sidebarWidth(), "full sidebar on a laptop").toBe(260);

  await page.setViewportSize({ width: 820, height: 800 });
  await page.waitForTimeout(600);
  expect(await sidebarWidth(), "icon rail once the window is narrowed, without a reload").toBe(70);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(600);
  expect(await sidebarWidth(), "and back again when it is widened").toBe(260);
});

test("a portrait tablet does not give a third of the screen to navigation", async ({ page }) => {
  // 768 was the exact width the old `max-width: 767px` query missed, so an iPad
  // in portrait kept the full 260px rail - 34% of the screen.
  await loginAs(page, "pm");
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/pm", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const share = await page.evaluate(() => {
    const aside = document.querySelector("aside")!;
    return aside.getBoundingClientRect().width / window.innerWidth;
  });
  expect(share, "share of a portrait tablet spent on the sidebar").toBeLessThan(0.15);
});
