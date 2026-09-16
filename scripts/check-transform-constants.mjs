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
   * The snapping rules above are still genuinely duplicated - they are inline
   * arithmetic in the drag handlers, which is what this gate exists for.
   */
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
