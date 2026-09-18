import { test, expect } from "@playwright/test";
import { apiLogin, clientUrl, monitorPageFailures } from "./helpers";
import { API_URL } from "../playwright.config";

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
    // The hero leads with the quote CTA; "Start Designing" is the secondary.
    await expect(page.getByTestId("btn-hero-quote")).toBeVisible();
    await expect(page.getByTestId("btn-hero-cta1")).toBeVisible();
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

  test("translated section copy renders from i18n keys", async ({ page }) => {
    await page.goto(clientUrl("/"));

    // CS-12: this copy moved from hardcoded JSX into home.* keys. A failed
    // lookup renders the raw key or nothing, so assert the resolved text.
    await expect(page.getByRole("heading", { name: "System Comparison" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "From Brief to Build in 7 Steps" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Built for the Whole Team" })).toBeVisible();

    // Array-valued keys resolved via returnObjects.
    await expect(page.getByRole("heading", { name: "3D Booth Workspace" })).toBeVisible();
    await expect(page.getByText("Initial Brief", { exact: true })).toBeVisible();
    await expect(page.getByText("Full visibility across every project.")).toBeVisible();

    // No unresolved i18n keys leaked into the page.
    await expect(page.getByText(/home\.(featureCards|workflow|team|showcase)/)).toHaveCount(0);
  });

  test("browser zoom is not disabled", async ({ page }) => {
    await page.goto(clientUrl("/"));

    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).not.toMatch(/maximum-scale|user-scalable\s*=\s*no/i);
  });
});

test.describe("Right-to-left support", () => {
  test("Arabic renders the landing page in RTL without horizontal overflow", async ({ page }) => {
    await page.goto(clientUrl("/?lang=ar"));

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByTestId("btn-hero-cta1")).toBeVisible();

    // CS-13: direction-sensitive layout previously used physical left/right
    // utilities. A mirrored page that overflows horizontally is the usual
    // symptom of one that was missed.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("Arabic keeps the legal pages readable", async ({ page }) => {
    await page.goto(clientUrl("/privacy?lang=ar"));

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("legal-title")).toBeVisible();
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

  test("the showcase nav link reveals the showcase instead of navigating away", async ({ page }) => {
    await page.goto(clientUrl("/"));

    // "Showcase" appears in both the nav and the footer; scope to the nav.
    await page.getByRole("navigation").getByRole("button", { name: "Showcase" }).click();

    // Must stay on the marketing page; the anchor scrolls, it does not route.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#showcase")).toBeInViewport({ timeout: 10_000 });
  });

  test("the hero quote CTA routes to the lead form", async ({ page }) => {
    await page.goto(clientUrl("/"));

    await page.getByTestId("btn-hero-quote").click();

    await expect(page).toHaveURL(/\/get-quote$/);
  });

  /**
   * Submitting the form, not just reaching it.
   *
   * The test above stopped at the navigation, and that was the whole gap: the
   * lead endpoint answered 503 for every real submission - the configured
   * organization slug matched no organization - and this suite stayed green
   * because nothing ever pressed the button. Reaching a form proves routing.
   * Only a submission that turns into a row proves lead intake.
   */
  test("submitting the quote form creates a lead the agency can see", async ({ page, request }) => {
    const stamp = Date.now();
    const company = `E2E Quote Co ${stamp}`;
    const email = `e2e-lead-${stamp}@example.test`;

    await page.goto(clientUrl("/get-quote"));
    await page.getByTestId("input-company").fill(company);
    await page.getByTestId("input-name").fill("E2E Prospect");
    await page.getByTestId("input-email").fill(email);

    const submission = page.waitForResponse(
      (res) => res.url().includes("/leads") && res.request().method() === "POST",
    );
    await page.getByTestId("button-submit-quote").click();
    const response = await submission;

    // A 503 here is the original defect: the form works, the lead is gone.
    expect(
      response.status(),
      "lead intake rejected the submission - check DEFAULT_ORGANIZATION_SLUG names a real organization",
    ).toBe(201);

    // And the visitor is told it worked.
    await expect(page.getByTestId("input-company")).toBeHidden();

    // The row has to exist on the agency side, not just in the response.
    // apiLogin stores the session cookie on this request context.
    expect(await apiLogin(request, "chief")).toBe(true);
    const clients = await request.get(`${API_URL}/api/platform/clients?status=lead`);
    expect(clients.ok()).toBe(true);
    const body = await clients.json();
    const landed = (body.clients ?? []).find(
      (c: { contactEmail?: string }) => c.contactEmail === email,
    );
    expect(landed, `no lead row for ${email} - the submission was accepted but not filed`).toBeTruthy();
  });
});
