import { test, expect } from "@playwright/test";

/**
 * Placement and mounting rules in the booth renderer (WS-19).
 *
 * These rules were rebuilt over several rounds, and each round was verified by
 * hand with a throwaway script that was then deleted - so every following
 * change was free to break the previous one, and repeatedly did. The renderer
 * is 4,300 lines of untyped inline JavaScript with no other test covering it,
 * which is exactly the code that needs a regression net.
 *
 * The renderer is driven through its real postMessage interface rather than by
 * poking at internals: `catalogDragPreview` is what the workspace sends while a
 * catalogue item is dragged over the booth, and the reply is what decides where
 * the item lands. Testing through it means these assertions hold for the path
 * the product actually uses.
 *
 * Booth is 6 x 3 m, so the back and front walls carry six 1 m panels and each
 * side carries three - panel centres land on the half metre.
 */

const BOOTH_W = 6;
const BOOTH_D = 3;
const RENDERER = `/booth-render.html?w=${BOOTH_W}&d=${BOOTH_D}&h=2.2&name=TEST`;

/** Panel centres along the back and front walls, in booth coordinates. */
const BACK_CENTRES = Array.from({ length: BOOTH_W }, (_, i) => i + 0.5);
/** Panel centres along the left and right walls. */
const SIDE_CENTRES = Array.from({ length: BOOTH_D }, (_, i) => i + 0.5);

type DropResult = { x: number; z: number; valid: boolean; reason: string | null };

type DragItem = {
  catalogId: string;
  name: string;
  w: number;
  d: number;
  h: number;
  shape: string;
};

const SHELF: DragItem = { catalogId: "sedef-224", name: "RAF - SHELF", w: 1.03, d: 0.33, h: 0.1, shape: "shelf" };
const LIGHT: DragItem = { catalogId: "sedef-417", name: "LAMBA", w: 0.3, d: 0.16, h: 0.28, shape: "rail_light" };
const COUNTER: DragItem = { catalogId: "ens-208", name: "BANKO - COUNTER", w: 1.0, d: 0.55, h: 1.0, shape: "counter" };

/** Asks the renderer where an item dropped at this screen point would land. */
async function dropAt(page: import("@playwright/test").Page, item: DragItem, xPct: number, yPct: number) {
  return page.evaluate(
    ({ item, xPct, yPct }) =>
      new Promise<DropResult | null>((resolve) => {
        const onMessage = (event: MessageEvent) => {
          const data = event.data as Record<string, unknown> | null;
          if (!data || data.type !== "catalogDropPreview") return;
          window.removeEventListener("message", onMessage);
          resolve({
            x: Number(data.x),
            z: Number(data.z),
            valid: Boolean(data.valid),
            reason: typeof data.reason === "string" ? data.reason : null,
          });
        };
        window.addEventListener("message", onMessage);
        window.postMessage({ type: "catalogDragPreview", xPct, yPct, item }, "*");
        setTimeout(() => {
          window.removeEventListener("message", onMessage);
          resolve(null);
        }, 2000);
      }),
    { item, xPct, yPct },
  ) as Promise<DropResult | null>;
}

/** Screen points spread across the visible floor. */
function floorGrid() {
  const points: Array<[number, number]> = [];
  for (let x = 0.2; x <= 0.84; x += 0.08) {
    for (let y = 0.5; y <= 0.86; y += 0.09) {
      points.push([Number(x.toFixed(3)), Number(y.toFixed(3))]);
    }
  }
  return points;
}

test.describe("Booth mounting rules", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RENDERER, { waitUntil: "networkidle" });
    // The renderer builds its geometry after first paint.
    await page.waitForTimeout(1200);
  });

  test("a shelf always lands on the centre of a wall panel", async ({ page }) => {
    // A shelf spans one panel exactly, so a shelf that stops half way across a
    // joint is not buildable. Wherever it is dropped it belongs on a centre.
    const offCentre: string[] = [];
    let landed = 0;

    for (const [x, y] of floorGrid()) {
      const result = await dropAt(page, SHELF, x, y);
      if (!result?.valid) continue;
      landed += 1;
      const onBackOrFront = Math.abs(result.z) < 0.35 || Math.abs(result.z - BOOTH_D) < 0.35;
      const centres = onBackOrFront ? BACK_CENTRES : SIDE_CENTRES;
      const along = onBackOrFront ? result.x : result.z;
      if (!centres.some((centre) => Math.abs(along - centre) < 0.06)) {
        offCentre.push(`(${x}, ${y}) -> x=${result.x.toFixed(2)} z=${result.z.toFixed(2)}`);
      }
    }

    expect(landed, "the probe grid should reach the floor at all").toBeGreaterThan(4);
    expect(offCentre, "shelves that missed a panel centre").toEqual([]);
  });

  test("a light always lands against a wall", async ({ page }) => {
    // Lights ride the top beam of a wall frame. One dropped mid-floor has to
    // travel to a wall rather than hang in the middle of the booth.
    const adrift: string[] = [];
    let landed = 0;

    for (const [x, y] of floorGrid()) {
      const result = await dropAt(page, LIGHT, x, y);
      if (!result?.valid) continue;
      landed += 1;
      const onWall =
        Math.abs(result.z) < 0.12 ||
        Math.abs(result.z - BOOTH_D) < 0.12 ||
        Math.abs(result.x) < 0.12 ||
        Math.abs(result.x - BOOTH_W) < 0.12;
      if (!onWall) adrift.push(`(${x}, ${y}) -> x=${result.x.toFixed(2)} z=${result.z.toFixed(2)}`);
    }

    expect(landed, "the probe grid should reach the floor at all").toBeGreaterThan(4);
    expect(adrift, "lights that stopped away from every wall").toEqual([]);
  });

  test("furniture reaches a corner, flush on both walls at once", async ({ page }) => {
    // The back-left corner: half the counter's own width from the left wall and
    // half its depth from the back one. Snapping to only the nearest wall - the
    // original behaviour - leaves the other side floating.
    const targetX = COUNTER.w / 2;
    const targetZ = COUNTER.d / 2;
    let best: { x: number; z: number; error: number } | null = null;

    for (let x = 0.1; x <= 0.46; x += 0.03) {
      for (let y = 0.55; y <= 0.8; y += 0.03) {
        const result = await dropAt(page, COUNTER, Number(x.toFixed(3)), Number(y.toFixed(3)));
        if (!result?.valid) continue;
        const error = Math.abs(result.x - targetX) + Math.abs(result.z - targetZ);
        if (!best || error < best.error) best = { x: result.x, z: result.z, error };
      }
    }

    expect(best, "no valid drop found near the back-left corner").not.toBeNull();
    expect(best!.x, "distance from the left wall").toBeCloseTo(targetX, 2);
    expect(best!.z, "distance from the back wall").toBeCloseTo(targetZ, 2);
  });

  test("an overlap warns but does not refuse the placement", async ({ page }) => {
    // Uprights stand at every panel joint. Refusing a drop that clips one is
    // what made corners unreachable; a designer putting a counter tight against
    // a post knows the booth better than a collision box does.
    const results = [];
    for (const [x, y] of floorGrid()) {
      const result = await dropAt(page, COUNTER, x, y);
      if (result) results.push(result);
    }

    const onFloor = results.filter((r) => r.reason !== "Move onto the booth floor");
    expect(onFloor.length, "the probe grid should reach the floor at all").toBeGreaterThan(4);
    expect(
      onFloor.filter((r) => !r.valid),
      "drops on the floor that were refused",
    ).toEqual([]);
  });
});
