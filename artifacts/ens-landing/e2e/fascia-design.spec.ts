/**
 * Fascia templates, and the thing that makes them worth guarding.
 *
 * The board colour, the wordmark colour and the wordmark size are three
 * independent controls, and a template sets all three at once. The first
 * version set the board and the lettering but not the mounted name plate the
 * lettering sits on, so choosing a dark treatment produced white type on a
 * white plate: the sign disappeared while every control reported it was set,
 * and the 3D view was the only place it showed.
 *
 * So this does not check that the controls exist. It applies a dark template
 * and requires the rendered wordmark to still contrast with the board it is
 * mounted on.
 */
import { test, expect } from "@playwright/test";
import { loginAs, TEST_CREDS } from "./helpers";
import { API_URL } from "../playwright.config";

test("a fascia template restyles the sign and keeps the wordmark legible", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await loginAs(page, "pm");

  // The disposable e2e database starts empty, so make the stand to open.
  // The API is a separate origin, so this signs in to it in its own right
  // rather than relying on the browser cookie reaching across.
  const login = await page.request.post(`${API_URL}/api/auth/login`, {
    data: { email: TEST_CREDS.pm.email, password: TEST_CREDS.pm.password, organizationSlug: TEST_CREDS.orgSlug },
  });
  expect(login.ok(), `api login failed: ${await login.text()}`).toBeTruthy();
  const created = await page.request.post(`${API_URL}/api/platform/projects`, {
    data: { name: "Fascia Fixture", client: "Fascia Co", system: "octanorm", widthM: 4, depthM: 3, deadline: "2026-12-01" },
  });
  expect(created.ok(), `project creation failed: ${await created.text()}`).toBeTruthy();
  const id = (await created.json()).project.id;

  await page.goto(`/pm/workspace?projectId=${id}`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator('iframe[title="Booth Renderer"]')).toHaveAttribute("data-renderer-ready", "true", { timeout: 20_000 });

  // The entry point that did not exist before: reach the fascia controls
  // without having to know you can click the board in the 3D view.
  const entry = page.getByRole("button", { name: /fascia design/i });
  await expect(entry, "the fascia section offers a way into the design controls").toBeVisible();
  await entry.click();
  await page.waitForTimeout(500);

  // The selected-part controls render below the stand configuration, so the
  // panel has to be scrolled before any of it is on screen.
  const charcoal = page.getByRole("button", { name: "Charcoal", exact: true });
  await charcoal.scrollIntoViewIfNeeded();
  await expect(charcoal, "the fascia templates are reachable from the fascia section").toBeVisible();
  await expect(page.getByRole("button", { name: "Classic", exact: true })).toBeVisible();
  await expect(page.getByText(/Choose logo or fascia design/i), "artwork upload sits with the templates").toBeVisible();

  await charcoal.click();
  await page.waitForTimeout(800);

  // The board colour the template chose, read back from the control.
  const boardHex = await page.getByRole("textbox", { name: /fascia color hex value/i }).inputValue();
  expect(boardHex.toLowerCase()).toBe("#23262c");

  /**
   * Every board on the band, not just the one that was selected.
   *
   * The first version applied the treatment to the selected board alone. A
   * visitor sees three of the fascia's four faces, so the front changed, the
   * returns stayed white, and from the floor it looked exactly as though
   * nothing had happened - which is how it was reported.
   */
  const boards = await page.evaluate(() => {
    const doc = (document.querySelector('iframe[title="Booth Renderer"]') as HTMLIFrameElement | null)?.contentDocument;
    const fills: Record<string, string> = {};
    doc?.querySelectorAll("[data-pid*='-body']").forEach((node) => {
      const id = node.getAttribute("data-pid") || "";
      const side = id.match(/^fascia-(front|back|left|right)-body/)?.[1];
      if (side) fills[side] = (node as SVGElement).getAttribute("fill") || "";
    });
    return fills;
  });
  expect(Object.keys(boards).sort(), "all four fascia boards are drawn").toEqual(["back", "front", "left", "right"]);
  for (const [side, fill] of Object.entries(boards)) {
    expect(fill.toLowerCase(), `the ${side} fascia board kept its default fill`).toBe("#23262c");
  }

  const frame = page.frameLocator('iframe[title="Booth Renderer"]');
  const wordmark = frame.locator("text", { hasText: "FASCIA CO" }).first();
  await expect(wordmark, "the wordmark is drawn on the stand").toBeVisible();
  const textFill = await wordmark.getAttribute("fill");

  /**
   * The plate the lettering is actually mounted on, not the board colour the
   * control reports.
   *
   * Comparing the text against the control's value is what a first version of
   * this test did, and it passed with the bug present: the control said
   * charcoal, the text was white, and the contrast looked fine - while the
   * plate between them was still white and the sign was invisible. The plate
   * is the only thing a reader sees behind the type, so it is the only thing
   * worth measuring against. It carries the mounting stroke, which is what
   * distinguishes it from the board behind it.
   */
  const plateFill = await frame.locator('polygon[stroke="#c7ccd4"]').first().getAttribute("fill");
  expect(plateFill, "the mounted name plate is drawn").toBeTruthy();

  const luminance = (hex: string) => {
    const value = hex.replace("#", "");
    const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  expect(textFill, "the wordmark must have an explicit colour").toBeTruthy();
  const contrast = Math.abs(luminance(textFill!) - luminance(plateFill!));
  expect(
    contrast,
    `the wordmark (${textFill}) is invisible against the plate it is mounted on (${plateFill})`,
  ).toBeGreaterThan(0.3);
});
