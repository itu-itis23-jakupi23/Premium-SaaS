import { test, expect } from "@playwright/test";
import { clientUrl, monitorPageFailures } from "./helpers";

/**
 * Public marketing surface coverage (CS-17).
 *
 * Every other spec in this suite authenticates first, so the logged-out pages
 * a prospect actually sees had no browser coverage at all. These tests run
 * against the client portal, where "/" renders the marketing home page.
 *
 * They assert the things that silently rot: that legal routes resolve instead
 * of falling through to the 404 page, that CTAs reach what they promise, and
 * that the staging noindex directive is still in place.
 */

const LEGAL_ROUTES = [
  { slug: "privacy", title: "Privacy Policy" },
  { slug: "terms", title: "Terms of Service" },
  { slug: "security", title: "Security" },
  { slug: "cookies", title: "Cookie Policy" },
  { slug: "gdpr", title: "GDPR" },
] as const;

test.describe("Public marketing surface", () => {
  test("landing page renders without authentication", async ({ page }) => {
    await page.goto(clientUrl("/"));

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("btn-hero-cta1")).toBeVisible();
    await expect(page.getByTestId("btn-hero-cta2")).toBeVisible();
  });

  test("landing page loads with no console or page errors", async ({ page }) => {
    const assertNoPageFailures = monitorPageFailures(page);

    await page.goto(clientUrl("/"));
    await expect(page.getByTestId("btn-hero-cta1")).toBeVisible();
    await page.waitForLoadState("networkidle");

    await assertNoPageFailures();
  });

  test("staging noindex directive is still present", async ({ page }) => {
    await page.goto(clientUrl("/"));

    // Guards against shipping an indexable pre-launch site. When the platform
    // launches, this expectation flips together with CS-01.
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute("content", /noindex/i);
  });

  test("social preview metadata is present", async ({ page }) => {
    await page.goto(clientUrl("/"));

    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /.+/);
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", /.+/);
  });

  test("showcase includes a workspace interface preview with alt text", async ({ page }) => {
    await page.goto(clientUrl("/"));

    const preview = page.getByTestId("img-workspace-preview");
    await preview.scrollIntoViewIfNeeded();

    await expect(preview).toBeVisible();
    // Decorative-only product imagery is an accessibility failure; the alt
    // text must describe what the workspace actually shows.
    await expect(preview).toHaveAttribute("alt", /octanorm|workspace|booth/i);
  });

  test("illustrative figures are labelled as examples, not live data", async ({ page }) => {
    await page.goto(clientUrl("/"));

    await expect(page.getByTestId("label-hero-stats-illustrative")).toBeVisible();

    const showcaseLabel = page.getByTestId("label-showcase-illustrative");
    await showcaseLabel.scrollIntoViewIfNeeded();
    await expect(showcaseLabel).toBeVisible();
  });

  test("browser zoom is not disabled", async ({ page }) => {
    await page.goto(clientUrl("/"));

    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).not.toMatch(/maximum-scale|user-scalable\s*=\s*no/i);
  });
});

test.describe("Legal documents", () => {
  for (const { slug, title } of LEGAL_ROUTES) {
    test(`/${slug} resolves to real content`, async ({ page }) => {
      await page.goto(clientUrl(`/${slug}`));

      await expect(page.getByTestId("legal-title")).toHaveText(title);
      // A missing route would fall through to the 404 page instead.
      await expect(page.getByText(/page not found/i)).toHaveCount(0);
    });
  }

  test("legal pages disclose that counsel review is outstanding", async ({ page }) => {
    await page.goto(clientUrl("/privacy"));

    // This notice must remain until COUNSEL_REVIEWED flips to true. If a
    // lawyer has signed off and the flag was flipped, update this test
    // deliberately rather than deleting it.
    await expect(page.getByTestId("legal-review-notice")).toBeVisible();
  });

  test("footer legal links navigate to their documents", async ({ page }) => {
    await page.goto(clientUrl("/"));

    await page.getByTestId("link-legal-privacy").click();

    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByTestId("legal-title")).toHaveText("Privacy Policy");
  });

  test("legal pages cross-link to each other", async ({ page }) => {
    await page.goto(clientUrl("/terms"));

    await page.getByRole("link", { name: "Cookie Policy" }).click();

    await expect(page).toHaveURL(/\/cookies$/);
    await expect(page.getByTestId("legal-title")).toHaveText("Cookie Policy");
  });
});

test.describe("Marketing calls to action", () => {
  test("Contact Sales opens a mail path instead of the login screen", async ({ page }) => {
    await page.goto(clientUrl("/"));

    const contactSales = page.getByTestId("btn-contact-sales");
    await expect(contactSales).toHaveAttribute("href", /^mailto:/);
  });

  test("pricing Enterprise tier contacts sales rather than signup", async ({ page }) => {
    await page.goto(clientUrl("/"));

    const pricingContact = page.getByTestId("btn-pricing-contact-sales");
    await expect(pricingContact).toHaveAttribute("href", /^mailto:/);
  });

  test("Watch Demo reveals the showcase instead of navigating away", async ({ page }) => {
    await page.goto(clientUrl("/"));

    await page.getByTestId("btn-hero-cta2").click();

    // Must stay on the marketing page; it previously navigated to /login.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#showcase")).toBeInViewport({ timeout: 10_000 });
  });
});
