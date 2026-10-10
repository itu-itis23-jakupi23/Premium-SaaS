import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ENS_FURNITURE_ITEMS, catalogFurnitureProps } from "../src/lib/furniture-catalog";

test("large scenes stay within resolution and update budgets on a throttled CPU", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/booth-render.html?w=20&d=10&renderer=performance-check");
  await page.waitForFunction(() => typeof (window as unknown as { __updateGlbLayer?: unknown }).__updateGlbLayer === "function", undefined, { timeout: 10_000 });
  const measurements = [];
  const evidence = resolve(import.meta.dirname, "../../../.release-evidence");
  mkdirSync(evidence, { recursive: true });
  const templates = ENS_FURNITURE_ITEMS.filter((item) => item.modelUrl).slice(0, 3).map((item) => ({ ...item, ...catalogFurnitureProps(item) }));
  for (const count of [10, 50, 100]) {
    const started = await page.evaluate(({ count, templates }) => {
      const placedItems = Array.from({ length: count }, (_, index) => ({
        ...templates[index % templates.length], id: `stress-${index}`,
        x: (index % 20) + 0.5, z: Math.floor(index / 20) + 0.5, y: 0,
      }));
      const started = performance.now();
      // Use the same bridge as the workspace so both SVG and GLB own the scene.
      window.postMessage({ type: "boothUpdate", w: 20, d: 10, placedItems }, "*");
      return started;
    }, { count, templates });
    await page.waitForFunction((count) => (window as unknown as { __rendererPerformance?: { objects: number } }).__rendererPerformance?.objects === count, count, { timeout: 20_000 });
    const result = await page.evaluate(async ({ count, started }) => {
      const bridge = window as unknown as {
        __lastGlbState: Record<string, unknown>;
        __updateGlbLayer: (state: Record<string, unknown>) => Promise<void>;
        __rendererPerformance: { durationMs: number; objects: number; pixels: number; drawCalls: number; triangles: number; shadowUpdates: number };
      };
      const cold = { ...bridge.__rendererPerformance };
      const coldElapsedMs = performance.now() - started;
      // Repeated camera-only updates should reuse already loaded model instances.
      const warm = [];
      const warmShadowUpdates = [];
      for (let index = 0; index < 5; index++) {
        // Camera interactions arrive on animation frames, rather than issuing
        // five GPU renders in the same JavaScript task without a paint.
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await bridge.__updateGlbLayer({ ...bridge.__lastGlbState, cam: [8 + index, 8, 14] });
        warm.push(bridge.__rendererPerformance.durationMs);
        warmShadowUpdates.push(bridge.__rendererPerformance.shadowUpdates);
      }
      return { count, cold, coldElapsedMs, warm, warmShadowUpdates, maxWarmMs: Math.max(...warm) };
    }, { count, started });
    measurements.push(result);
    writeFileSync(resolve(evidence, "workspace-performance.json"), JSON.stringify({ measuredAt: new Date().toISOString(), cpuSlowdown: 4, measurements }, null, 2));
    expect(result.cold.objects).toBe(count);
    expect(result.cold.shadowUpdates).toBeGreaterThan(0);
    expect(result.warmShadowUpdates).toEqual(Array(5).fill(result.cold.shadowUpdates));
    expect(result.cold.pixels).toBeLessThanOrEqual(4_000_000);
    expect(result.coldElapsedMs).toBeLessThan(15_000);
    // This detects severe stalls, rather than claiming a real-device FPS target.
    expect(result.maxWarmMs).toBeLessThan(1500);
  }
  // Cached bounds must invalidate after an edit, and model removal must still work.
  const beforeEdit = await page.evaluate(() => (window as unknown as { __rendererPerformance: { shadowUpdates: number } }).__rendererPerformance.shadowUpdates);
  await page.evaluate(() => {
    const bridge = window as unknown as { __lastGlbState: { placedItems: Record<string, unknown>[] } };
    const placedItems = bridge.__lastGlbState.placedItems.map((item, index) => index === 0 ? { ...item, w: 0.9 } : item);
    window.postMessage({ type: "boothUpdate", placedItems }, "*");
  });
  await page.waitForFunction(() => (window as unknown as { __glbPhysicalBounds: Map<string, { targetWidth: number }> }).__glbPhysicalBounds.get("stress-0")?.targetWidth === 0.9);
  // Bounds update before the final GPU render. Wait for the completed shadow
  // pass as well, including any coalesced SVG refresh after model replacement.
  await page.waitForFunction((before) => (window as unknown as { __rendererPerformance: { shadowUpdates: number } }).__rendererPerformance.shadowUpdates > before, beforeEdit);
  const beforeLighting = await page.evaluate(() => (window as unknown as { __rendererPerformance: { shadowUpdates: number } }).__rendererPerformance.shadowUpdates);
  await page.evaluate(() => window.postMessage({ type: "boothUpdate", lightingPreset: "ambient" }, "*"));
  await page.waitForFunction((before) => (window as unknown as { __rendererPerformance: { shadowUpdates: number } }).__rendererPerformance.shadowUpdates > before, beforeLighting);
  const beforeRemoval = await page.evaluate(() => (window as unknown as { __rendererPerformance: { shadowUpdates: number } }).__rendererPerformance.shadowUpdates);
  await page.evaluate(() => window.postMessage({ type: "boothUpdate", placedItems: [] }, "*"));
  await page.waitForFunction(() => (window as unknown as { __rendererPerformance?: { objects: number } }).__rendererPerformance?.objects === 0);
  await page.waitForFunction((before) => (window as unknown as { __rendererPerformance: { shadowUpdates: number } }).__rendererPerformance.shadowUpdates > before, beforeRemoval);
  const report = JSON.stringify({ measuredAt: new Date().toISOString(), cpuSlowdown: 4, measurements }, null, 2);
  writeFileSync(resolve(evidence, "workspace-performance.json"), report);
  await testInfo.attach("workspace-performance", { body: report, contentType: "application/json" });
});
