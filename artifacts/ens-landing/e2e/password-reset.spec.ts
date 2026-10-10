import { test, expect } from "@playwright/test";
import { clientUrl } from "./helpers";

/**
 * Forgot-password and reset-password, in a browser.
 *
 * Both pages were complete and neither was covered: auth.spec.ts tests signup,
 * login, logout, session refresh and role boundaries, and stops there. This is
 * the only account-recovery path in the product, so if it breaks, a locked-out
 * user has no way back in and no way to tell anyone.
 *
 * Driven against the **client** origin deliberately. On the staff origin these
 * routes render inside `StaffGateway` - the first version of this file pointed
 * there and spent five tests asserting against the gateway's copy rather than
 * the form. The client portal has no such gate, and a client who has forgotten
 * their password is the case with real users behind it.
 *
 * Nothing here needs seeded data, which is what makes it worth having: these
 * assertions hold on any environment.
 */

test.describe("Forgot password", () => {
  test("rejects a malformed address before sending anything", async ({ page }) => {
    await page.goto(clientUrl("/forgot-password"));
    await page.getByTestId("input-email").fill("not-an-email");
    await page.getByTestId("button-reset").click();

    // Caught client-side by the zod resolver, so the form stays on screen.
    await expect(page.getByTestId("input-email")).toBeVisible();
  });

  test("confirms submission without revealing whether the account exists", async ({ page }) => {
    const unknown = `definitely-not-registered-${Date.now()}@example.test`;
    await page.goto(clientUrl("/forgot-password"));
    await page.getByTestId("input-email").fill(unknown);
    await page.getByTestId("button-reset").click();

    // The API answers 200 for any address on purpose, and the page has to
    // match it: a different screen for an unknown address would hand an
    // attacker the account enumeration the API refuses to give them.
    await expect(page.getByTestId("input-email")).toBeHidden({ timeout: 20_000 });
    const text = await page.locator("body").innerText();
    expect(text).toContain(unknown);
    expect(text.toLowerCase()).not.toMatch(/not found|no account|unknown address|does not exist/);
  });

  test("offers a resend only after a cooldown", async ({ page }) => {
    await page.goto(clientUrl("/forgot-password"));
    await page.getByTestId("input-email").fill(`cooldown-${Date.now()}@example.test`);
    await page.getByTestId("button-reset").click();

    // The client-side half of the rate limit the API now enforces on this
    // endpoint; without it a frustrated user hammers the button and throttles
    // themselves out of their own recovery.
    const resend = page.getByRole("button", { name: /resend|again|\d+\s*s/i }).first();
    await expect(resend).toBeVisible({ timeout: 20_000 });
    await expect(resend).toBeDisabled();
  });

  test("lets the sender correct a mistyped address", async ({ page }) => {
    await page.goto(clientUrl("/forgot-password"));
    await page.getByTestId("input-email").fill("typo@example.test");
    await page.getByTestId("button-reset").click();
    await expect(page.getByTestId("input-email")).toBeHidden({ timeout: 20_000 });

    // Without this the only way back to the form is a reload, and the address
    // on screen is the wrong one.
    await page.getByRole("button", { name: /different|another|change/i }).first().click();
    await expect(page.getByTestId("input-email")).toBeVisible();
  });
});

test.describe("Reset password", () => {
  /** A well-formed but unissued token, so the form renders and the API rejects. */
  const UNISSUED_TOKEN = "0".repeat(64);

  test("explains itself when opened with no token", async ({ page }) => {
    // Where someone lands after a mail client truncates the link.
    await page.goto(clientUrl("/reset-password"));
    await page.waitForLoadState("networkidle");

    // Copy is "Invalid link" / "This password reset link is invalid or has
    // expired. Please request a new one."
    await expect(page.locator("body")).toContainText(/invalid/i, { timeout: 20_000 });
    await expect(page.getByRole("link", { name: /request new/i })).toBeVisible();
  });

  test("requires the two passwords to match", async ({ page }) => {
    await page.goto(clientUrl(`/reset-password?token=${UNISSUED_TOKEN}`));

    await page.getByTestId("input-password").fill("CorrectHorse1!");
    await page.getByTestId("input-confirm-password").fill("DifferentHorse1!");
    await page.getByTestId("button-reset").click();

    // A mismatch has to be caught in the form. Sending it would spend the
    // single-use token on a password the user did not mean to set.
    await expect(page.getByTestId("input-password")).toBeVisible();
    await expect(page.locator("body")).toContainText(/match/i);
  });

  test("reports a rejected token rather than appearing to succeed", async ({ page }) => {
    await page.goto(clientUrl(`/reset-password?token=${UNISSUED_TOKEN}`));

    const strong = "CorrectHorseBattery1!";
    await page.getByTestId("input-password").fill(strong);
    await page.getByTestId("input-confirm-password").fill(strong);
    await page.getByTestId("button-reset").click();

    // The API answers 400 invalid_token. Silently doing nothing, or claiming
    // success, leaves the user waiting for a login that will never work.
    await expect(page.locator("body")).toContainText(/invalid|expired|again|wrong/i, { timeout: 20_000 });
  });

  test("shows the strength meter as a password is typed", async ({ page }) => {
    await page.goto(clientUrl(`/reset-password?token=${UNISSUED_TOKEN}`));

    const field = page.getByTestId("input-password");
    await field.fill("a");
    const weak = await page.locator("body").innerText();
    await field.fill("CorrectHorseBattery1!");
    const strong = await page.locator("body").innerText();

    // The meter is the only guidance on what this app considers acceptable,
    // so it has to actually react rather than render a fixed label.
    expect(weak).not.toBe(strong);
  });
});
