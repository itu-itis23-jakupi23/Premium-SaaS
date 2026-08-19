import { describe, expect, it } from "vitest";
import {
  itemPositionBounds,
  rotatedItemFootprint,
  positionBoundsForItem,
  roomPlacementIssue,
  placementIssuesFor,
} from "./workspace-geometry";
import type { BoothState, WorkspacePlacedItem, WorkspaceRoom } from "./workspace-model";

const booth: BoothState = {
  width: 6, depth: 3, height: 2.5, system: "octanorm", companyName: "Test",
  openFront: true, openBack: false, openLeft: false, openRight: false,
  fasciaEnabled: true, fasciaOption: "full",
};

function item(over: Partial<WorkspacePlacedItem> = {}): WorkspacePlacedItem {
  return {
    id: over.id ?? "i1", catalogId: "c", name: over.name ?? "Item", sku: "s", qty: 1,
    w: 1, d: 1, h: 1, color: "#000", weight: 10, x: 3, z: 1.5, rotation: 0,
    kind: "furniture", shape: "box", ...over,
  };
}

function room(over: Partial<WorkspaceRoom> = {}): WorkspaceRoom {
  return {
    id: over.id ?? "r1", name: over.name ?? "Room", width: 2, depth: 2, height: 2.5,
    x: 1, z: 1, hasDoor: false, hasCeiling: false, doorSide: "front", doorWidth: 0.9,
    doorPosition: "center", doorSwing: "left-in", doorOpen: false, wallFinish: "white",
    floorColor: "#eee", locked: false, designWall: "front", designFit: "contain", ...over,
  };
}

describe("itemPositionBounds", () => {
  it("keeps an item within the booth minus wall clearance", () => {
    const b = itemPositionBounds(1, 1, booth);
    expect(b.minX).toBeGreaterThan(0);
    expect(b.maxX).toBeLessThan(booth.width);
    expect(b.minX).toBeLessThanOrEqual(b.maxX);
    expect(b.minZ).toBeLessThanOrEqual(b.maxZ);
  });
});

describe("rotatedItemFootprint", () => {
  it("swaps width/depth at 90 degrees", () => {
    const f = rotatedItemFootprint(item({ w: 2, d: 1, rotationY: 90 }));
    expect(f.width).toBeCloseTo(1, 5);
    expect(f.depth).toBeCloseTo(2, 5);
  });
  it("is unchanged at 0 degrees", () => {
    const f = rotatedItemFootprint(item({ w: 2, d: 1, rotationY: 0 }));
    expect(f.width).toBeCloseTo(2, 5);
    expect(f.depth).toBeCloseTo(1, 5);
  });
  it("accounts for rotation when computing position bounds", () => {
    const wide = positionBoundsForItem(item({ w: 4, d: 1, rotationY: 0 }), booth);
    const rotated = positionBoundsForItem(item({ w: 4, d: 1, rotationY: 90 }), booth);
    // Rotating a wide item narrows its X footprint, widening the allowed X range.
    expect(rotated.maxX - rotated.minX).toBeGreaterThan(wide.maxX - wide.minX);
  });
});

describe("placementIssuesFor", () => {
  it("flags two overlapping items", () => {
    const issues = placementIssuesFor([item({ id: "a", x: 3, z: 1.5 }), item({ id: "b", x: 3.1, z: 1.5 })], [], booth, []);
    expect(issues.some((i) => i.itemId === "a" && i.message.startsWith("Overlaps"))).toBe(true);
    expect(issues.some((i) => i.itemId === "b" && i.message.startsWith("Overlaps"))).toBe(true);
  });
  it("passes non-overlapping, in-bounds items", () => {
    const issues = placementIssuesFor([item({ id: "a", x: 1, z: 1 }), item({ id: "b", x: 5, z: 2 })], [], booth, []);
    expect(issues).toHaveLength(0);
  });
  it("flags an item outside the usable booth floor", () => {
    const issues = placementIssuesFor([item({ id: "a", x: 20, z: 1.5 })], [], booth, []);
    expect(issues.some((i) => i.message.includes("Outside"))).toBe(true);
  });
  it("flags an item blocking a structural support rail", () => {
    const issues = placementIssuesFor([item({ id: "a", x: 3, z: 1.5 })], [], booth, [3]);
    expect(issues.some((i) => i.message.includes("support rail"))).toBe(true);
  });
});

describe("roomPlacementIssue", () => {
  it("reports overlapping rooms", () => {
    const a = room({ id: "a", name: "A", x: 1, z: 1 });
    const b = room({ id: "b", name: "B", x: 1.5, z: 1 });
    expect(roomPlacementIssue(a, [a, b], [])).toMatch(/Overlaps/);
  });
  it("returns empty for a clear placement", () => {
    const a = room({ id: "a", name: "A", x: 1, z: 1 });
    const b = room({ id: "b", name: "B", x: 5, z: 2 });
    expect(roomPlacementIssue(a, [a, b], [])).toBe("");
  });
});
