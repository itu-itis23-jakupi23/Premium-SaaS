import { test, expect } from "@playwright/test";
import { ENS_FURNITURE_ITEMS, catalogFurnitureProps } from "../src/lib/furniture-catalog";

/**
 * WS-13: what the booth does when a furniture model will not load.
 *
 * A GLB arrives over the network, so sometimes it does not: a flaky
 * connection, a sleeping laptop, an asset missing from a deploy. The renderer
 * already has a sensible answer - the item keeps its placeholder box, so the
 * stand still shows something of the right size in the right place - but
 * nothing proved it, and the recovery half was broken.
 *
 * Models are cached by url and the cache was never cleared on failure, so a
 * rejected promise stayed under that url for the life of the page. One
 * dropped request and that piece of furniture never appeared again, however
 * many times the stand was reopened or the item re-added: a permanent grey
 * box that looks like a model somebody chose rather than one that failed.
 */

const model = ENS_FURNITURE_ITEMS.find((item) => item.modelUrl);

type GlbWindow = Window & {
  __updateGlbLayer?: unknown;
  __glbVisibleItems?: Set<string>;
};

test("a furniture model that fails to load leaves a placeholder, and loads on the next attempt", async ({ page }) => {
  test.setTimeout(90_000);
  expect(model, "the catalogue must ship at least one 3D model to test").toBeTruthy();

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  let failModels = true;
  let modelRequests = 0;
  await page.route("**/*.glb", async (route) => {
    modelRequests += 1;
    if (failModels) {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await page.goto("/booth-render.html?w=8&d=6");
  await page.waitForFunction(
    () => typeof (window as GlbWindow).__updateGlbLayer === "function",
    undefined,
    { timeout: 15_000 },
  );

  const placed = { ...model!, ...catalogFurnitureProps(model!) };
  const place = async (x: number) => {
    await page.evaluate(
      ({ placed, x }) => {
        window.postMessage(
          { type: "boothUpdate", w: 8, d: 6, placedItems: [{ ...placed, id: "broken-asset-1", x, z: 2, y: 0 }] },
          "*",
        );
      },
      { placed, x },
    );
  };

  await place(2);
  await expect.poll(() => modelRequests, { timeout: 15_000 }).toBeGreaterThan(0);

  // Degraded, not broken: the model is absent from the visible set, so the
  // placeholder box stays, and the rest of the stand is untouched.
  await expect
    .poll(
      async () => page.evaluate(() => ((window as GlbWindow).__glbVisibleItems?.size ?? 0)),
      { timeout: 10_000 },
    )
    .toBe(0);

  const sceneAfterFailure = await page.evaluate(() => ({
    svgPresent: Boolean(document.querySelector("svg.scene")),
    canvasPresent: Boolean(document.getElementById("glbCanvas")),
  }));
  expect(sceneAfterFailure.svgPresent, "the booth still draws without its models").toBe(true);
  expect(sceneAfterFailure.canvasPresent).toBe(true);
  expect(pageErrors, "a missing model must not take the renderer down").toEqual([]);

  /**
   * The load-bearing half. With the failure cached under its url this never
   * recovers, however many updates arrive - which is the bug this guards.
   * Negative-tested by restoring the cached rejection: the poll below times
   * out with the model still invisible.
   */
  const requestsBeforeRetry = modelRequests;
  failModels = false;
  await place(3);

  await expect
    .poll(
      async () => page.evaluate(() => ((window as GlbWindow).__glbVisibleItems?.size ?? 0)),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);

  expect(
    modelRequests,
    "recovery must come from a real second request, not a cached success",
  ).toBeGreaterThan(requestsBeforeRetry);
  expect(pageErrors).toEqual([]);
});
