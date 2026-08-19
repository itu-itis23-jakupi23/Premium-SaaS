import { describe, expect, it } from "vitest";
import {
  clampNumber,
  snapNumber,
  snapItemCoordinate,
  FURNITURE_SNAP_M,
  ROOM_SNAP_M,
  ROOM_DIMENSION_SNAP_M,
  ROOM_CORNER_SNAP_M,
  ITEM_WALL_CLEARANCE_M,
  DUPLICATE_OFFSET_M,
  POSITION_DECIMALS,
} from "./workspace-transform";

// These functions are the single source of truth for booth placement snapping
// on the React side, and the same numbers are reused by the renderer and (soon)
// any mobile client. A regression here silently misaligns dragging vs. numeric
// entry, so the math is pinned explicitly.

describe("constants", () => {
  it("hold their documented values (guards against silent drift)", () => {
    expect(FURNITURE_SNAP_M).toBe(0.05);
    expect(ROOM_SNAP_M).toBe(0.5);
    expect(ROOM_DIMENSION_SNAP_M).toBe(1);
    expect(ROOM_CORNER_SNAP_M).toBe(0.32);
    expect(ITEM_WALL_CLEARANCE_M).toBe(0.25);
    expect(DUPLICATE_OFFSET_M).toBe(0.35);
    expect(POSITION_DECIMALS).toBe(3);
  });
});

describe("clampNumber", () => {
  it("returns the value when within range", () => {
    expect(clampNumber(5, 0, 10)).toBe(5);
  });
  it("clamps below the minimum and above the maximum", () => {
    expect(clampNumber(-3, 0, 10)).toBe(0);
    expect(clampNumber(42, 0, 10)).toBe(10);
  });
  it("handles the boundary and a zero-width range", () => {
    expect(clampNumber(0, 0, 10)).toBe(0);
    expect(clampNumber(10, 0, 10)).toBe(10);
    expect(clampNumber(7, 3, 3)).toBe(3);
  });
  it("works with negative ranges", () => {
    expect(clampNumber(-5, -10, -1)).toBe(-5);
    expect(clampNumber(-20, -10, -1)).toBe(-10);
  });
});

describe("snapNumber", () => {
  it("snaps to the nearest multiple of the default room grid (0.5 m)", () => {
    expect(snapNumber(1.2)).toBe(1);
    expect(snapNumber(1.3)).toBe(1.5);
    expect(snapNumber(1.75)).toBe(2); // rounds half away from zero via Math.round
  });
  it("snaps to a custom step (furniture grid, 5 cm)", () => {
    expect(snapNumber(1.23, FURNITURE_SNAP_M)).toBe(1.25);
    expect(snapNumber(1.22, FURNITURE_SNAP_M)).toBe(1.2);
    expect(snapNumber(0.02, FURNITURE_SNAP_M)).toBe(0);
  });
  it("cleans up floating-point noise to POSITION_DECIMALS", () => {
    // 1.4 / 0.05 * 0.05 is the classic 1.4000000000000001 case.
    const snapped = snapNumber(1.4, FURNITURE_SNAP_M);
    expect(snapped).toBe(1.4);
    expect(Number.isInteger(snapped * 1000)).toBe(true);
  });
  it("snaps negative values symmetrically", () => {
    expect(snapNumber(-1.3)).toBe(-1.5);
    expect(snapNumber(-1.23, FURNITURE_SNAP_M)).toBe(-1.25);
  });
});

describe("snapItemCoordinate", () => {
  it("snaps to the furniture grid and keeps within bounds", () => {
    expect(snapItemCoordinate(1.23, 0, 5)).toBe(1.25);
  });
  it("clamps to the maximum after snapping", () => {
    expect(snapItemCoordinate(9.99, 0, 3)).toBe(3);
  });
  it("clamps to the minimum after snapping", () => {
    expect(snapItemCoordinate(-9.99, -2, 5)).toBe(-2);
  });
  it("never returns a value outside the bounds for arbitrary inputs", () => {
    for (const v of [-100, -1.234, 0, 0.5, 2.7777, 50]) {
      const r = snapItemCoordinate(v, -1, 4);
      expect(r).toBeGreaterThanOrEqual(-1);
      expect(r).toBeLessThanOrEqual(4);
    }
  });
});
