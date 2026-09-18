/**
 * Workspace transform constant alignment gate (WS-03).
 *
 * Snapping rules exist in two places that must agree:
 *
 *   - `src/lib/workspace-transform.ts` — the source of truth, used by the
 *     React state layer and the inspector's numeric inputs.
 *   - `booth-render.html` — the standalone Three.js iframe renderer, which
 *     snaps during pointer drags. It is a self-contained HTML file and cannot
 *     import the module, so it encodes the same rules as inline arithmetic.
 *
 * The renderer writes a 5 cm grid as `Math.round(next * 20) / 20`. That does
 * not visibly say "0.05", so the two representations could drift apart in
 * silence: dragging an item in 3D and typing its coordinates into the
 * inspector would land on different grids, and no test would notice.
 *
 * This check derives the reciprocal the renderer *should* use from the
 * module's own value, then asserts the renderer contains it. Change the module
 * and this gate names the expression to update.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const landingRoot = resolve(root, "artifacts", "ens-landing");
const modulePath = resolve(landingRoot, "src", "lib", "workspace-transform.ts");
// The renderer is a page plus the engine it loads. The snapping rules live in
// the engine, which was lifted out of the page so the app can run under an
// enforced CSP - so both are read, and either one may carry a rule.
const rendererPaths = [
  resolve(landingRoot, "booth-render.html"),
  resolve(landingRoot, "public", "booth-render.js"),
];

const failures = [];
const fail = (message) => failures.push(message);

if (!existsSync(modulePath)) fail("src/lib/workspace-transform.ts is missing");
for (const path of rendererPaths) {
  if (!existsSync(path)) fail(`${path.split(/[\\/]/).pop()} is missing`);
}

if (failures.length === 0) {
  const moduleSource = readFileSync(modulePath, "utf8");
  const renderer = rendererPaths.map((path) => readFileSync(path, "utf8")).join("\n");

  /** Read `export const NAME = <number>;` out of the module. */
  function constant(name) {
    const match = moduleSource.match(
      new RegExp(`export const ${name}\\s*=\\s*([0-9.]+)\\s*;`),
    );
    if (!match) {
      fail(`could not read ${name} from workspace-transform.ts`);
      return null;
    }
    return Number(match[1]);
  }

  const furnitureSnap = constant("FURNITURE_SNAP_M");
  const roomSnap = constant("ROOM_SNAP_M");
  const cornerSnap = constant("ROOM_CORNER_SNAP_M");
  /*
   * The clearance constants used to be checked here too, because the renderer
   * carried its own copy of them. It no longer does: item/room/booth collision
   * lives once in workspace-geometry.ts and the renderer loads it compiled, so
   * those numbers reach it by import rather than by being written out twice.
   * What guards them now is scripts/build-placement-bundle.mjs --check, which
   * fails when the compiled copy has drifted from the source.
   *
   * The snapping rules are still genuinely duplicated - they are inline
   * arithmetic in the drag handlers, which is what this gate exists for, and
   * what the rest of this block compares.
   */

  // The drag handlers snap by rounding to a reciprocal grid:
  //   Math.round(nextX * 20) / 20   ==  a 1/20 = 0.05 m grid
  // Anchoring on nextX/nextZ keeps this away from the renderer's other
  // Math.round sites, which round for output precision rather than snapping.
  const gridSites = [...renderer.matchAll(
    /Math\.round\(\s*next[XZ]\s*\*\s*([0-9.]+)\s*\)\s*\/\s*([0-9.]+)/g,
  )];
  if (gridSites.length < 4) {
    fail(
      `expected at least 4 snap-to-grid sites on nextX/nextZ in the renderer, found ${gridSites.length} ` +
      "(if the drag handlers were renamed, update this gate rather than deleting it)",
    );
  }
  for (const [text, multiplier, divisor] of gridSites) {
    if (multiplier !== divisor) {
      fail(`renderer snaps with mismatched grid arithmetic: ${text.trim()}`);
      continue;
    }
    const step = 1 / Number(multiplier);
    if (furnitureSnap !== null && Math.abs(step - furnitureSnap) > 1e-9) {
      fail(
        `renderer snaps to a ${step} m grid (${text.trim()}) but ` +
        `FURNITURE_SNAP_M is ${furnitureSnap}`,
      );
    }
  }
  // Rooms share the furniture grid; a divergence means one of the two moved.
  if (furnitureSnap !== null && roomSnap !== null && furnitureSnap !== roomSnap) {
    fail(
      `FURNITURE_SNAP_M (${furnitureSnap}) and ROOM_SNAP_M (${roomSnap}) differ, but the renderer ` +
      "rounds furniture and rooms on the same grid - teach this gate which is which before they diverge",
    );
  }

  // The placeable plan around the stand. Both files carried a comment saying
  // this gate kept them honest, and it did not read this constant at all -
  // which is how a number stops being checked by hand without anyone noticing.
  // The renderer uses it as `PLAN_MARGIN_M + floorTolerance` to decide how far
  // outside the booth something may be dropped, so a drift here means the
  // renderer and the workspace disagree about what is placeable.
  const planMargin = constant("PLAN_MARGIN_M");
  const rendererPlanMargin = renderer.match(/const\s+PLAN_MARGIN_M\s*=\s*([0-9.]+)\s*;/);
  if (!rendererPlanMargin) {
    fail("could not find the renderer's `const PLAN_MARGIN_M = <number>;` placeable-plan margin");
  } else if (planMargin !== null && Math.abs(Number(rendererPlanMargin[1]) - planMargin) > 1e-9) {
    fail(
      `renderer's placeable plan margin is ${rendererPlanMargin[1]} m but ` +
      `PLAN_MARGIN_M is ${planMargin}`,
    );
  }

  const cornerMatch = renderer.match(/const\s+cornerSnap\s*=\s*([0-9.]+)\s*;/);
  if (!cornerMatch) {
    fail("could not find the renderer's `const cornerSnap = <number>;` corner-snap radius");
  } else if (cornerSnap !== null && Math.abs(Number(cornerMatch[1]) - cornerSnap) > 1e-9) {
    fail(
      `renderer's corner snap radius is ${cornerMatch[1]} m but ROOM_CORNER_SNAP_M is ${cornerSnap}`,
    );
  }
}

if (failures.length > 0) {
  console.error("Transform constant check failed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    "Transform constant check passed: the booth renderer encodes the same snapping rules as workspace-transform.ts.",
  );
}
