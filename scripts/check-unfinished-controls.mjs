/**
 * Unfinished-control gate (AX-06).
 *
 * Checks the *built* production bundles, not the source. A flag that hides an
 * unfinished feature is only worth something if the feature actually leaves
 * the artifact users download, so this asserts against dist output.
 *
 * Two classes of failure:
 *
 *   1. Work-in-progress markers ("Coming Soon" and friends) shipped to users.
 *   2. A specific gated feature whose markup survived the build anyway —
 *      which happens when a flag is not statically foldable and the bundler
 *      cannot eliminate the branch.
 *
 * Translation catalogues are excluded from (2): locale JSON legitimately keeps
 * strings for features that are gated off, and pruning them per-build would
 * make the catalogues build-dependent.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = resolve(root, "artifacts", "ens-landing", "dist");

const failures = [];
const fail = (message) => failures.push(message);

/** Literal markers that must never reach a production bundle. */
const WIP_MARKERS = [
  "Coming Soon",
  "coming soon",
  "Not implemented",
  "FIXME",
];

/**
 * Markup markers for features gated off in production. Each must be absent
 * from the built JavaScript, proving the bundler dropped the branch rather
 * than shipping hidden code.
 */
const GATED_FEATURE_MARKERS = [
  { marker: 'settings-two-factor', feature: "two-factor settings block (AU-04)" },
];

function listFiles(directory) {
  const out = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

if (!existsSync(distRoot)) {
  fail(
    "artifacts/ens-landing/dist does not exist. Run the portal builds before this check.",
  );
} else {
  // Check exactly the portals the build scripts emit. Scanning whatever
  // directories happen to exist makes the result depend on leftover state:
  // dist/ still held a build from three weeks earlier, produced by a config
  // that no longer exists, and it failed this check on code that has since
  // been fixed.
  const PORTALS = ["staff", "client"];

  const present = readdirSync(distRoot).filter((entry) =>
    statSync(join(distRoot, entry)).isDirectory(),
  );

  const portals = PORTALS.filter((portal) => {
    if (present.includes(portal)) return true;
    fail(`missing build output artifacts/ens-landing/dist/${portal}. Run the portal builds first.`);
    return false;
  });

  const stale = present.filter((entry) => !PORTALS.includes(entry));
  if (stale.length > 0) {
    console.warn(
      `Note: ignoring unrecognised build output under dist/: ${stale.join(", ")}. ` +
        "No current build script produces these; consider deleting them.",
    );
  }

  for (const portal of portals) {
    const files = listFiles(join(distRoot, portal));
    const scripts = files.filter((path) => path.endsWith(".js"));
    const textual = files.filter(
      (path) => path.endsWith(".js") || path.endsWith(".html") || path.endsWith(".css"),
    );

    for (const path of textual) {
      const contents = readFileSync(path, "utf8");
      // Locale catalogues may legitimately retain strings for gated features.
      const isLocaleChunk = /locale|i18n|translation/i.test(path);

      for (const marker of WIP_MARKERS) {
        if (!isLocaleChunk && contents.includes(marker)) {
          fail(
            `${portal}: production bundle ${path.slice(distRoot.length + 1)} contains "${marker}". ` +
              "Finish the control or gate it behind a build-time flag.",
          );
        }
      }
    }

    for (const { marker, feature } of GATED_FEATURE_MARKERS) {
      const leaked = scripts.filter((path) => readFileSync(path, "utf8").includes(marker));
      if (leaked.length > 0) {
        fail(
          `${portal}: ${feature} survived the production build in ` +
            `${leaked.map((p) => p.slice(distRoot.length + 1)).join(", ")}. ` +
            "The flag guarding it is not statically foldable, so the bundler could not remove it.",
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Unfinished control check failed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    "Unfinished control check passed: no work-in-progress markers or gated-feature markup in the production bundles.",
  );
}
