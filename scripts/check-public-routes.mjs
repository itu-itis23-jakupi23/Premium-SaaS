/**
 * Public route and link integrity gate (CS-16).
 *
 * The marketing surface is not covered by the authenticated Playwright suite,
 * so nothing else in the release gate notices when a public link rots. This
 * check enforces three things:
 *
 *   1. Every internal link on a public page resolves to a route registered in
 *      App.tsx. A link to an unrouted path renders the 404 page.
 *   2. Legal links are never placeholders. These are compliance surfaces and
 *      must not regress to href="#".
 *   3. Placeholder links elsewhere are counted against a declining budget.
 *      The budget may only ever be lowered — a new placeholder fails the gate.
 *
 * The budget makes remaining dead-link debt a number that has to reach zero
 * before launch, rather than something that rots silently. `Home.tsx` is at
 * zero: its footer links to real page sections, routed legal documents, and a
 * mail path. `TeamLanding.tsx` still has three.
 *
 * The check deliberately fails when a count drops *below* its budget too, so
 * an improvement gets locked in rather than leaving headroom for a regression.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const landingSrc = resolve(root, "artifacts", "ens-landing", "src");

const failures = [];
const fail = (message) => failures.push(message);

// ── Placeholder budget ───────────────────────────────────────────────────────
// Occurrences of href="#" per public page. Lower these as real pages ship.
// Do not raise them.
const PLACEHOLDER_BUDGET = {
  "pages/Home.tsx": 0, // every link resolves: section anchors, legal routes, mailto
  "pages/TeamLanding.tsx": 3,
};

// Routes registered in App.tsx that a public page may link to.
const STATIC_PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/signup",
  "/team",
  "/forgot-password",
  "/reset-password",
]);

// ── Legal slugs are the source of truth in slugs.ts ──────────────────────────
const slugsPath = resolve(landingSrc, "pages", "legal", "slugs.ts");
if (!existsSync(slugsPath)) {
  fail("artifacts/ens-landing/src/pages/legal/slugs.ts is missing");
}

const slugsSource = existsSync(slugsPath) ? readFileSync(slugsPath, "utf8") : "";
const slugMatch = slugsSource.match(/LEGAL_SLUGS\s*=\s*\[([^\]]*)\]/);
const legalSlugs = slugMatch
  ? [...slugMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
  : [];

if (legalSlugs.length === 0) {
  fail("could not parse LEGAL_SLUGS from slugs.ts");
}

// Every legal slug must have a document in content.ts.
const contentPath = resolve(landingSrc, "pages", "legal", "content.ts");
const contentSource = existsSync(contentPath) ? readFileSync(contentPath, "utf8") : "";
if (!contentSource) {
  fail("artifacts/ens-landing/src/pages/legal/content.ts is missing");
}
for (const slug of legalSlugs) {
  if (!new RegExp(`slug:\\s*["']${slug}["']`).test(contentSource)) {
    fail(`legal route "/${slug}" has no document defined in content.ts`);
  }
}

// Every legal slug must be routed in App.tsx.
const appSource = readFileSync(resolve(landingSrc, "App.tsx"), "utf8");
if (!/LEGAL_SLUGS\.map/.test(appSource)) {
  fail("App.tsx does not register the legal routes from LEGAL_SLUGS");
}

const knownRoutes = new Set([...STATIC_PUBLIC_ROUTES, ...legalSlugs.map((s) => `/${s}`)]);

// ── Per-page link checks ─────────────────────────────────────────────────────
for (const [relativePath, budget] of Object.entries(PLACEHOLDER_BUDGET)) {
  const filePath = resolve(landingSrc, relativePath);
  if (!existsSync(filePath)) {
    fail(`${relativePath} is missing`);
    continue;
  }

  const rawSource = readFileSync(filePath, "utf8");

  // Strip block comments before counting. A comment explaining why a
  // placeholder was removed should not itself register as a placeholder.
  const source = rawSource.replace(/\/\*[\s\S]*?\*\//g, "");

  const placeholders = (source.match(/href="#"/g) ?? []).length;
  if (placeholders > budget) {
    fail(
      `${relativePath} has ${placeholders} placeholder links but the budget is ${budget}. ` +
        "Point the new link at a real route instead of href=\"#\".",
    );
  } else if (placeholders < budget) {
    fail(
      `${relativePath} has ${placeholders} placeholder links, below its budget of ${budget}. ` +
        `Lower PLACEHOLDER_BUDGET["${relativePath}"] to ${placeholders} to lock in the improvement.`,
    );
  }

  // Internal links must resolve to a registered route.
  for (const [, href] of source.matchAll(/href=\{?["'`](\/[^"'`{}\s]*)["'`]\}?/g)) {
    const path = href.split(/[?#]/)[0];
    if (path !== "/" && path.endsWith("/")) continue;
    if (!knownRoutes.has(path)) {
      fail(`${relativePath} links to "${path}", which is not a registered public route`);
    }
  }

  // Legal links specifically must not be placeholders.
  for (const slug of legalSlugs) {
    const testId = `link-legal-${slug}`;
    if (source.includes(testId) && !source.includes(`/${slug}`)) {
      fail(`${relativePath} marks a ${slug} link but does not point it at /${slug}`);
    }
  }
}

// ── Staging consistency: robots.txt and the noindex meta must agree ──────────
const indexPath = resolve(root, "artifacts", "ens-landing", "index.html");
const robotsPath = resolve(root, "artifacts", "ens-landing", "public", "robots.txt");

if (!existsSync(robotsPath)) {
  fail("artifacts/ens-landing/public/robots.txt is missing");
} else {
  const html = readFileSync(indexPath, "utf8");
  const robots = readFileSync(robotsPath, "utf8");

  const htmlNoindex = /<meta\b[^>]*name=["']robots["'][^>]*noindex/i.test(html);
  const robotsDisallowAll = /^\s*Disallow:\s*\/\s*$/im.test(
    robots.replace(/^\s*#.*$/gm, ""),
  );

  if (htmlNoindex !== robotsDisallowAll) {
    fail(
      "index.html robots meta and public/robots.txt disagree: " +
        `meta noindex=${htmlNoindex}, robots.txt disallow-all=${robotsDisallowAll}. ` +
        "Both must be staging, or both must be production.",
    );
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error("Public route check failed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Public route check passed: ${legalSlugs.length} legal routes resolve, ` +
      "internal links are registered, and staging directives agree.",
  );
}
