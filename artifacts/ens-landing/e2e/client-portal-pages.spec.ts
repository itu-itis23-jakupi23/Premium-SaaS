import { test, expect, type Page } from "@playwright/test";
import { clientUrl, loginAs } from "./helpers";

/**
 * Every client portal route, driven in a browser.
 *
 * The client portal had nine pages and no page-level test of any kind, and the
 * defects that were found in it were all found by reading rather than by
 * running: a cancelled project rendering green, a preview modal that previewed
 * nothing, two contradicting progress models on one screen. The pure logic
 * behind those now has unit tests, but nothing checked that the pages
 * themselves still render.
 *
 * These assertions are deliberately state-independent. The seeded client may
 * be awaiting approval, may have no quotes and no invoices, so anything that
 * asserted on business data would be testing the fixture. What holds in every
 * state is: the route resolves, nothing throws, and the copy is real text
 * rather than untranslated keys.
 */

const CLIENT_ROUTES = [
  "/client",
  "/client/projects",
  "/client/workspace",
  "/client/quotes",
  "/client/invoices",
  "/client/documents",
  "/client/messages",
  "/client/profile",
  "/client/approvals",
] as const;

/**
 * A translation key that reached the DOM instead of its string.
 *
 * i18next returns the key itself on a miss, so a missing key renders as
 * `client.quotes.title` in the page — visible, but easy to miss in review and
 * invisible to a typecheck. Anchored on the namespaces this app actually uses,
 * and requires two dots, so ordinary prose and domain names do not match.
 */
const RAW_KEY_PATTERN =
  /\b(?:client|help|experience|quotes|invoices|clientQuotes|clientInvoices|common|nav)\.[a-z][a-zA-Z0-9]*\.[a-zA-Z0-9.]+/;

/** Noise every browser produces that says nothing about the app. */
function realErrors(messages: string[]): string[] {
  return messages.filter(
    (message) =>
      !message.includes("ResizeObserver") &&
      !message.includes("Non-passive") &&
      !message.includes("404") &&
      !message.includes("Failed to fetch"),
  );
}

async function visibleText(page: Page): Promise<string> {
  return (await page.locator("body").innerText()).trim();
}

test.describe("Client portal pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "client");
  });

  for (const route of CLIENT_ROUTES) {
    test(`${route} renders without throwing`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto(clientUrl(route));
      await page.waitForLoadState("networkidle");

      expect(realErrors(errors), `${route} threw: ${realErrors(errors).join(" | ")}`).toHaveLength(0);
      // Not a blank page: a crashed render and a successful one both return 200.
      expect((await visibleText(page)).length, `${route} rendered no text`).toBeGreaterThan(20);
    });

    test(`${route} shows translated copy, not raw keys`, async ({ page }) => {
      await page.goto(clientUrl(route));
      await page.waitForLoadState("networkidle");

      const text = await visibleText(page);
      const match = text.match(RAW_KEY_PATTERN);
      expect(match?.[0], `${route} rendered the raw key "${match?.[0]}"`).toBeUndefined();
    });
  }

  test("the help markers open and close", async ({ page }) => {
    // Help hints were added across the portal on the argument that a client
    // needs them; one that cannot be opened is decoration. The invoices page
    // carries them on the summary cards.
    await page.goto(clientUrl("/client/invoices"));
    await page.waitForLoadState("networkidle");

    const hints = page.getByTestId("help-hint");
    const count = await hints.count();
    if (count === 0) {
      // No invoices means no summary cards, so nothing to open. Say so rather
      // than passing silently on an empty fixture.
      test.skip(true, "no help markers on this page in the seeded state");
      return;
    }

    await hints.first().click();
    // The popover is the explanation; it has a heading and a body.
    await expect(page.getByRole("dialog").or(page.locator("[data-radix-popper-content-wrapper]")).first())
      .toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("a help marker does not activate the control it sits inside", async ({ page }) => {
    // The hints on the Projects page sit inside the card header, which is
    // itself a button that expands the card. Without stopPropagation, asking
    // what a figure means also toggled the card.
    await page.goto(clientUrl("/client/projects"));
    await page.waitForLoadState("networkidle");

    const hints = page.getByTestId("help-hint");
    if ((await hints.count()) === 0) {
      test.skip(true, "no projects in the seeded state, so no card hints");
      return;
    }

    const expandable = page.locator('[aria-expanded]').first();
    const before = await expandable.getAttribute("aria-expanded");
    await hints.first().click();
    const after = await expandable.getAttribute("aria-expanded");
    expect(after, "opening a help hint toggled the card it sits in").toBe(before);
  });
});
