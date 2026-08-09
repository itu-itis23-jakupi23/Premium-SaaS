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
const rendererPath = resolve(landingRoot, "booth-render.html");

const failures = [];
const fail = (message) => failures.push(message);

if (!existsSync(modulePath)) fail("src/lib/workspace-transform.ts is missing");
if (!existsSync(rendererPath)) fail("booth-render.html is missing");

if (failures.length === 0) {
  const moduleSource = readFileSync(modulePath, "utf8");
  const renderer = readFileSync(rendererPath, "utf8");

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
  const wallClearance = constant("ITEM_WALL_CLEARANCE_M");

  /**
   * A grid of `step` is written in the renderer as `Math.round(v * R) / R`
   * where R = 1 / step. Assert that reciprocal appears at least `count` times,
   * since each axis is snapped separately.
   */
  function expectGridFactor(label, step, count) {
    if (step === null) return;
    const reciprocal = 1 / step;
    if (!Number.isInteger(reciprocal)) {
      fail(`${label}: ${step} has no integer reciprocal; renderer cannot encode it this way`);
      return;
    }
    const pattern = new RegExp(
      `Math\\.round\\([^)]*\\*\\s*${reciprocal}\\s*\\)\\s*/\\s*${reciprocal}`,
      "g",
    );
    const found = (renderer.match(pattern) ?? []).length;
    if (found < count) {
      fail(
        `${label}: expected at least ${count} occurrence(s) of a ${step} m grid in booth-render.html ` +
          `(written as \`Math.round(v * ${reciprocal}) / ${reciprocal}\`) but found ${found}. ` +
          "The renderer and workspace-transform.ts have diverged.",
      );
    }
  }

  // Furniture drag snaps X and Z separately.
  expectGridFactor("FURNITURE_SNAP_M", furnitureSnap, 2);
  // Room drag snaps X and Z separately.
  expectGridFactor("ROOM_SNAP_M", roomSnap, 2);

  /**
   * Assert a value appears in the specific renderer expression that uses it.
   *
   * Searching for a bare number is useless here: booth-render.html is ~175 KB
   * of geometry maths, so almost any small decimal occurs somewhere by
   * coincidence and the check passes no matter what the module says. Anchoring
   * to the assignment makes the match mean something.
   */
  function expectExpression(label, value, buildPattern, expression) {
    if (value === null) return;
    const escaped = String(value).replace(".", "\\.");
    if (!buildPattern(escaped).test(renderer)) {
      fail(
        `${label}: booth-render.html does not contain \`${expression(value)}\`. ` +
          "The renderer and workspace-transform.ts have diverged.",
      );
    }
  }

  expectExpression(
    "ROOM_CORNER_SNAP_M",
    cornerSnap,
    (v) => new RegExp(`cornerSnap\\s*=\\s*${v}(?![0-9])`),
    (v) => `const cornerSnap = ${v}`,
  );

  expectExpression(
    "ITEM_WALL_CLEARANCE_M",
    wallClearance,
    (v) => new RegExp(`wallClearance\\s*=\\s*Math\\.max\\([^,]*,\\s*${v}(?![0-9])`),
    (v) => `const wallClearance = Math.max(..., ${v})`,
  );
}

if (failures.length > 0) {
  console.error("Transform constant check failed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    "Transform constant check passed: booth-render.html encodes the same snapping rules as workspace-transform.ts.",
  );
}
