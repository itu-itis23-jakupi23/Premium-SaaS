import { describe, expect, it } from "vitest";
import { PLAN_MARGIN_M, ROOM_ITEM_PAD_M, ROOM_WALL_CLEARANCE_M } from "@/lib/workspace-transform";
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
  it("reaches the plan around the stand, not just its footprint", () => {
    // A screen, a totem or a counter serving the aisle belongs outside the
    // walls. The bounds used to stop at the footprint, so those could not be
    // drawn at all - but they still have to stop somewhere, or an item could be
    // dragged off the edge of the drawing and never found again.
    const b = itemPositionBounds(1, 1, booth);
    expect(b.minX, "the plan to the left of the stand is placeable").toBeLessThan(0);
    expect(b.maxX, "the plan to the right of the stand is placeable").toBeGreaterThan(booth.width);
    expect(b.minX).toBeGreaterThan(-PLAN_MARGIN_M);
    expect(b.maxX).toBeLessThan(booth.width + PLAN_MARGIN_M);
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

describe("furniture inside a room", () => {
  // The renderer clamps a dragged item to the room interior and this module
  // decides whether the result may be kept. They measure the same interior:
  // ROOM_WALL_CLEARANCE_M off the wall plus ROOM_ITEM_PAD_M around the item.
  // When they did not, a drag let go of a cabinet 3 cm inside the wall, this
  // half answered "crosses a room wall", and it sprang back for no visible
  // reason. These cases pin the boundary from both sides.
  const store = room({ id: "r", name: "Store", x: 1.5, z: 1.5, width: 3, depth: 2 });
  const inset = ROOM_WALL_CLEARANCE_M + ROOM_ITEM_PAD_M;

  it("accepts an item standing at the interior limit", () => {
    // Right edge of a 1 m wide item exactly `inset` off the inside of the wall.
    const x = store.x + store.width / 2 - inset - 0.5;
    const issues = placementIssuesFor([item({ id: "a", x, z: store.z })], [store], booth, []);
    expect(issues).toHaveLength(0);
  });

  it("rejects the same item a centimetre further into the wall", () => {
    const x = store.x + store.width / 2 - inset - 0.5 + 0.01;
    const issues = placementIssuesFor([item({ id: "a", x, z: store.z })], [store], booth, []);
    expect(issues.some((i) => i.message.includes("wall"))).toBe(true);
  });

  it("leaves an item clear of the room outside alone", () => {
    const x = store.x + store.width / 2 + 0.5 + ROOM_ITEM_PAD_M + 0.01;
    const issues = placementIssuesFor([item({ id: "a", x, z: store.z })], [store], booth, []);
    expect(issues).toHaveLength(0);
  });

  it("keeps the door clearance free", () => {
    const withDoor = room({ ...store, hasDoor: true, doorSide: "front", doorWidth: 0.9 });
    const issues = placementIssuesFor(
      [item({ id: "a", x: withDoor.x, z: withDoor.z + withDoor.depth / 2 - 0.4, w: 0.5, d: 0.5 })],
      [withDoor], booth, [],
    );
    expect(issues.some((i) => i.message.includes("door clearance"))).toBe(true);
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
