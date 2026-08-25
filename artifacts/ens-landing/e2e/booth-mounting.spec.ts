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
/** Placeable plan around the stand - mirrors PLAN_MARGIN_M. */
const PLAN_MARGIN = 3;
const RENDERER = `/booth-render.html?w=${BOOTH_W}&d=${BOOTH_D}&h=2.2&name=TEST`;

/** Panel centres along the back and front walls, in booth coordinates. */
const BACK_CENTRES = Array.from({ length: BOOTH_W }, (_, i) => i + 0.5);
/** Panel centres along the left and right walls. */
const SIDE_CENTRES = Array.from({ length: BOOTH_D }, (_, i) => i + 0.5);

type DropResult = { x: number; z: number; y: number | null; valid: boolean; reason: string | null };

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
            y: Number.isFinite(Number(data.y)) ? Number(data.y) : null,
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

/** Sends one item to the renderer and reads back where it actually ended up. */
async function placeAndRead(
  page: import("@playwright/test").Page,
  item: Record<string, unknown>,
): Promise<{ x: number; z: number } | null> {
  return page.evaluate(async (placed) => {
    window.postMessage({ type: "boothUpdate", placedItems: [placed] }, "*");
    await new Promise((done) => setTimeout(done, 700));
    const state = (window as typeof window & {
      __pendingGlbState?: { placedItems?: Array<{ id?: string; x?: number; z?: number }> };
    }).__pendingGlbState;
    const found = state?.placedItems?.find((entry) => entry.id === placed.id);
    return found ? { x: Number(found.x), z: Number(found.z) } : null;
  }, item);
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

  test("a light lands on an overhead rail, at the rail's own height", async ({ page }) => {
    // A booth has two kinds of overhead profile a light can clamp to: the top
    // beam of each wall frame, and the ceiling support rails that cross the
    // booth front to back. This test used to assert only the first, which is
    // why it stayed green while every light in the product hung in mid-air:
    // lights were being snapped to the wall *lines* and to a height a full
    // fixture below the beam, and the test agreed with the bug.
    const { rails, underside } = await page.evaluate(() => {
      const scope = globalThis as unknown as {
        activeFrontSupportPositions: () => number[];
        lightRailUnderside: () => number;
      };
      return { rails: scope.activeFrontSupportPositions(), underside: scope.lightRailUnderside() };
    });
    expect(underside, "the rail should be overhead on a 2.2 m booth").toBeGreaterThan(2);

    const adrift: string[] = [];
    const wrongHeight: string[] = [];
    let landed = 0;
    let onRailCount = 0;

    for (const [x, y] of floorGrid()) {
      const result = await dropAt(page, LIGHT, x, y);
      if (!result?.valid) continue;
      landed += 1;

      // Wall beams sit half the fixture's depth inside the wall line.
      const onBeam =
        Math.abs(result.z) < 0.12 ||
        Math.abs(result.z - BOOTH_D) < 0.12 ||
        Math.abs(result.x) < 0.12 ||
        Math.abs(result.x - BOOTH_W) < 0.12;
      // A cross rail only counts when the light is genuinely out on it rather
      // than at the point where a rail meets a wall - otherwise wall-only
      // snapping would satisfy this by accident.
      const onRail = !onBeam && rails.some((rail) => Math.abs(result.x - rail) < 0.12);
      if (onRail) onRailCount += 1;
      if (!onBeam && !onRail) {
        adrift.push(`(${x}, ${y}) -> x=${result.x.toFixed(2)} z=${result.z.toFixed(2)}`);
      }

      // The fixture hangs from the profile, so its y sits just under it - not a
      // whole fixture-height below, and certainly not down at eye level.
      if (result.y == null || Math.abs(result.y - underside) > 0.1) {
        wrongHeight.push(`(${x}, ${y}) -> y=${result.y ?? "none"} vs rail ${underside.toFixed(3)}`);
      }
    }

    expect(landed, "the probe grid should reach the floor at all").toBeGreaterThan(4);
    expect(adrift, "lights that stopped away from every rail and beam").toEqual([]);
    expect(wrongHeight, "lights that did not hang at rail height").toEqual([]);
    if (rails.length > 0) {
      expect(onRailCount, "no light reached a ceiling support rail - they only found walls")
        .toBeGreaterThan(0);
    }
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

  test("a rotated item is bounded by its rotated footprint", async ({ page }) => {
    // The bound clamps against the item's footprint, and a turned item has a
    // different one. Using the unrotated width held a 1.0 x 0.55 counter 0.225 m
    // short of where it belonged - and the SVG path writes that correction back,
    // so the margin was re-applied every frame and the item could never be
    // pushed out to the limit however many times it was dragged.
    //
    // The limit is the edge of the placeable plan now rather than the booth
    // wall, since the plan around the stand is placeable too - but it is the
    // same clamp, and the same 0.225 m is at stake.
    const landed = await placeAndRead(page, {
      id: "edge-probe", catalogId: "ens-208", name: "BANKO - COUNTER",
      kind: "furniture", shape: "counter",
      w: 1.0, d: 0.55, h: 1.0, x: 20, z: 1.5, y: 0, rotationY: 90,
    });

    expect(landed, "the renderer did not report a position").not.toBeNull();
    // Rotated 90 degrees the counter is 0.55 across x, so half of that from the
    // plan edge. Judged on the raw width it would stop 0.225 m earlier.
    expect(landed!.x).toBeCloseTo(BOOTH_W + PLAN_MARGIN - 0.55 / 2, 2);
  });

  test("an item can stand on the plan outside the booth", async ({ page }) => {
    // Not everything an exhibitor brings stands inside the walls: a screen on a
    // bracket, a totem, a counter serving the aisle. Placement used to stop dead
    // at the footprint, so any of those was dragged back through the wall and
    // could not be drawn at all.
    const landed = await placeAndRead(page, {
      id: "aisle-screen", catalogId: "ens-208", name: "SCREEN",
      kind: "furniture", shape: "counter",
      w: 1.0, d: 0.55, h: 1.6, x: -2, z: 1.5, y: 0, rotationY: 0,
    });

    expect(landed, "the renderer did not report a position").not.toBeNull();
    // Two metres clear of the left edge, and it stays there. The old bounds
    // pulled it to half its own width *inside* the wall, at x = 0.5.
    expect(landed!.x, "the item was dragged back inside the booth").toBeLessThan(-1.5);
  });

  test("a room wall is drawn in front of what stands behind it", async ({ page }) => {
    // The renderer is a painter's algorithm: later in the DOM is nearer the
    // viewer. Faces sort by renderOrder first, and only fall through to depth
    // when the gap is under 0.0001. Rooms sat at ~0.00005 while furniture sits
    // at 0.24, so a room lost on renderOrder before depth was ever consulted -
    // every wall was painted first and every chair painted straight over it.
    // The walls read as transparent, which is exactly how it was reported.
    const order = await page.evaluate(
      () =>
        new Promise<{ room: number; item: number } | null>((resolve) => {
          const onAck = () => {
            window.removeEventListener("message", onAck);
            requestAnimationFrame(() => {
              const faces = [...document.querySelectorAll("[data-pid]")];
              let room = -1;
              let item = -1;
              faces.forEach((face, index) => {
                const pid = face.getAttribute("data-pid") || "";
                if (pid.startsWith("occlusion-room")) room = Math.max(room, index);
                if (pid.startsWith("occlusion-chair")) item = Math.max(item, index);
              });
              resolve({ room, item });
            });
          };
          window.addEventListener("message", onAck);
          window.postMessage({
            type: "boothUpdate",
            rooms: [{
              id: "occlusion-room", name: "Occlusion room",
              width: 2.4, depth: 1.6, height: 2.4,
              x: 3, z: 1.5, hasDoor: true, doorSide: "front",
              doorWidth: 0.9, doorPosition: "center", doorSwing: "left-in",
              doorOpen: false, hasCeiling: false,
              wallFinish: "white", floorColor: "#dddddd", locked: false,
            }],
            // Standing in the middle of that room, so a wall is between it and
            // the camera from every angle.
            placedItems: [{
              id: "occlusion-chair", catalogId: "sedef-149", name: "CHAIR",
              kind: "furniture", shape: "chair",
              w: 0.5, d: 0.45, h: 0.88, x: 3, z: 1.5, y: 0, rotationY: 0,
            }],
          }, "*");
          setTimeout(() => {
            window.removeEventListener("message", onAck);
            resolve(null);
          }, 4000);
        }),
    );

    expect(order, "the renderer never acknowledged the update").not.toBeNull();
    expect(order!.room, "no room faces were drawn at all").toBeGreaterThan(-1);
    expect(order!.item, "no furniture faces were drawn at all").toBeGreaterThan(-1);
    // The wall between the camera and the chair is nearer than the chair, so it
    // must be painted after it. Before the fix no room face was ever painted
    // after any furniture face, whatever the angle.
    expect(
      order!.room,
      "the room's nearest wall was painted behind the chair standing inside it",
    ).toBeGreaterThan(order!.item);
  });

  test("the plot boundary survives the contact shadow", async ({ page }) => {
    // The stand is near-white on a near-white ground, so what separates "the
    // plan" from "the booth" is the dashed plot line set out around it. It is
    // drawn into the same group as the contact shadow, whose Gaussian blur is
    // wide enough to erase a hairline completely - which it did, silently,
    // until the line was moved after it. Order is the whole fix, so order is
    // what this checks.
    const layout = await page.evaluate(() => {
      const floor = document.getElementById("floorGroup");
      if (!floor) return null;
      const children = [...floor.children];
      return {
        shadow: children.findIndex((el) => (el.getAttribute("filter") || "").includes("ground-shadow")),
        plot: children.findIndex((el) => el.hasAttribute("stroke-dasharray")),
        gridLines: children.filter((el) => el.tagName.toLowerCase() === "line").length,
        floor: children.filter((el) => (el.getAttribute("fill") || "").includes("#floor")).length,
      };
    });

    expect(layout, "the floor group was never built").not.toBeNull();
    expect(layout!.shadow, "no contact shadow under the stand").toBeGreaterThan(-1);
    expect(layout!.plot, "no plot boundary drawn around the stand").toBeGreaterThan(-1);
    expect(
      layout!.plot,
      "the plot boundary is drawn before the shadow, which blurs it away",
    ).toBeGreaterThan(layout!.shadow);
    // Metre lines on the ground, in world space. A screen-space pattern would
    // not need any.
    expect(layout!.gridLines, "no metre grid on the ground plan").toBeGreaterThan(8);
    // The ground quad was sized 44 x 32 m and drawn only when all four corners
    // projected. They do not in the default three-quarter view, so the floor
    // was skipped entirely and the backdrop gradient stood in for it - for as
    // long as that view has existed, with nothing to say so.
    expect(layout!.floor, "the ground plane was not drawn").toBe(1);
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
