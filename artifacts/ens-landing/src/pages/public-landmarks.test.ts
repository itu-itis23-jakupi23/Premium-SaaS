import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Landmark and bypass-link structure on the pages a logged-out visitor reaches.
 *
 * Regression guard for two WCAG failures found in the audit:
 *
 *   1.3.1 Info and Relationships — none of Home, TeamLanding, GetQuote or
 *   not-found wrapped their content in a <main>, so assistive tech had no
 *   "main content" landmark to jump to. Only the legal pages had one.
 *
 *   2.4.1 Bypass Blocks — the marketing pages open with a header full of
 *   navigation, a language switcher and a theme toggle, and offered no way past
 *   it. DashboardLayout had a skip link; no public page did.
 *
 * These are asserted against source rather than a rendered page so they run in
 * the fast unit suite. The rendered behaviour (skip link is the first tab stop
 * and moves focus to #main-content) is covered by the Playwright suite.
 */

/** Pages reachable without authentication. */
const PUBLIC_PAGES = [
  { file: "Home.tsx", hasHeader: true },
  { file: "TeamLanding.tsx", hasHeader: true },
  { file: "GetQuote.tsx", hasHeader: false },
  { file: "not-found.tsx", hasHeader: false },
  { file: "legal/LegalPage.tsx", hasHeader: true },
] as const;

function source(file: string): string {
  return readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), "utf8");
}

/** Counts <main> and <motion.main> openings, ignoring closing tags. */
function countMainLandmarks(src: string): number {
  return [...src.matchAll(/<(?:motion\.)?main[\s>]/g)].length;
}

describe("public page landmarks", () => {
  it.each(PUBLIC_PAGES)("$file has exactly one main landmark", ({ file }) => {
    expect(countMainLandmarks(source(file))).toBe(1);
  });

  it.each(PUBLIC_PAGES)("$file anchors its main landmark to the skip target", ({ file }) => {
    // The id must come from MAIN_CONTENT_ID rather than a hand-written string,
    // so the link and its target cannot drift apart.
    expect(source(file)).toContain("MAIN_CONTENT_ID");
  });

  it.each(PUBLIC_PAGES.filter((p) => p.hasHeader))(
    "$file offers a way to bypass its header",
    ({ file }) => {
      expect(source(file)).toContain("<SkipToContent");
    },
  );

  it.each(PUBLIC_PAGES.filter((p) => !p.hasHeader))(
    "$file has no skip link, having no repeated block to bypass",
    ({ file }) => {
      // WCAG 2.4.1 applies to repeated blocks. A single-purpose page with no
      // navigation gains nothing from a skip link except an extra tab stop.
      expect(source(file)).not.toContain("<SkipToContent");
    },
  );
});
