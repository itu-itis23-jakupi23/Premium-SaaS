import { describe, expect, it } from "vitest";
import { MAX_RENDER_PIXELS, rendererPixelRatio } from "./renderer-performance";

describe("renderer resolution budget", () => {
  it("preserves native density for ordinary laptop previews", () => {
    expect(rendererPixelRatio(1200, 750, 1)).toBe(1);
  });
  it.each([[1600, 1000, 2], [3840, 2160, 3], [7680, 4320, 2]])("bounds high-density GPU fill cost at %s × %s", (width, height, dpr) => {
    const ratio = rendererPixelRatio(width, height, dpr);
    expect(width * height * ratio * ratio).toBeLessThanOrEqual(MAX_RENDER_PIXELS + 1);
  });
  it("handles missing or invalid density", () => {
    expect(rendererPixelRatio(100, 100, NaN)).toBe(1);
    expect(rendererPixelRatio(100, 100, 0)).toBe(1);
  });
});
