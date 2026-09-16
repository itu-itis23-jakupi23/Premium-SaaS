import { describe, expect, it } from "vitest";
import { PLAN_MARGIN_M, ROOM_ITEM_PAD_M, ROOM_WALL_CLEARANCE_M } from "@/lib/workspace-transform";
import {
  itemPositionBounds,
  rotatedItemFootprint,
  positionBoundsForItem,
  roomPlacementIssue,
  placementIssuesFor,
  alignedPositions,
  distributedPositions,
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

describe("alignedPositions", () => {
  // Three items of different sizes, spread on both axes, so every alignment has
  // something to do and the size of each item matters to where it lands.
  const spread = () => [
    item({ id: "a", x: 1.0, z: 1.0, w: 0.4, d: 0.4 }),
    item({ id: "b", x: 2.0, z: 2.0, w: 1.0, d: 0.6 }),
    item({ id: "c", x: 3.0, z: 3.0, w: 0.6, d: 1.0 }),
  ];
  const edgesOf = (moved: { id: string; x: number; z: number }[], axis: "x" | "z") =>
    moved.map((position) => {
      const source = spread().find((entry) => entry.id === position.id)!;
      const half = (axis === "x" ? source.w : source.d) / 2;
      const centre = axis === "x" ? position.x : position.z;
      return { low: +(centre - half).toFixed(6), high: +(centre + half).toFixed(6) };
    });

  it("lines every left edge up on the leftmost one", () => {
    const edges = edgesOf(alignedPositions(spread(), "left"), "x");
    // 1.0 - 0.4/2 is the leftmost edge in the group.
    expect(edges.every((edge) => edge.low === 0.8)).toBe(true);
  });

  it("lines every right edge up on the rightmost one", () => {
    const edges = edgesOf(alignedPositions(spread(), "right"), "x");
    // 3.0 + 0.6/2 is the rightmost edge in the group.
    expect(edges.every((edge) => edge.high === 3.3)).toBe(true);
  });

  it("centres everything across the group's own extent", () => {
    const moved = alignedPositions(spread(), "centre-x");
    // Extent 0.8 to 3.3, so the centre line is 2.05 regardless of item size.
    expect(moved.every((position) => position.x === 2.05)).toBe(true);
  });

  it("lines every back edge up on the backmost one", () => {
    const edges = edgesOf(alignedPositions(spread(), "back"), "z");
    expect(edges.every((edge) => edge.low === 0.8)).toBe(true);
  });

  it("lines every front edge up on the frontmost one", () => {
    const edges = edgesOf(alignedPositions(spread(), "front"), "z");
    expect(edges.every((edge) => edge.high === 3.5)).toBe(true);
  });

  it("centres everything front-to-back", () => {
    const moved = alignedPositions(spread(), "centre-z");
    expect(moved.every((position) => position.z === 2.15)).toBe(true);
  });

  it("leaves the other axis exactly where it was", () => {
    const source = spread();
    for (const position of alignedPositions(source, "left")) {
      expect(position.z).toBe(source.find((entry) => entry.id === position.id)!.z);
    }
    for (const position of alignedPositions(source, "back")) {
      expect(position.x).toBe(source.find((entry) => entry.id === position.id)!.x);
    }
  });

  it("measures a turned item by the room it actually takes up", () => {
    // A 2.0 x 0.4 item turned 90 degrees is 0.4 across, so its left edge sits
    // 0.2 from its centre, not 1.0.
    const turned = [
      item({ id: "flat", x: 1.0, z: 1.0, w: 0.4, d: 0.4 }),
      item({ id: "turned", x: 2.0, z: 2.0, w: 2.0, d: 0.4, rotationY: 90 }),
    ];
    const moved = alignedPositions(turned, "left");
    const turnedAt = moved.find((position) => position.id === "turned")!;
    expect(turnedAt.x).toBeCloseTo(0.8 + 0.2, 6);
  });

  it("has nothing to do with fewer than two items", () => {
    expect(alignedPositions([], "left")).toEqual([]);
    expect(alignedPositions([item({ id: "only" })], "left")).toEqual([]);
  });
});

describe("distributedPositions", () => {
  it("leaves the ends alone and evens the gaps between them", () => {
    const uneven = [
      item({ id: "a", x: 1.0, z: 1.0 }),
      item({ id: "b", x: 1.4, z: 1.0 }),
      item({ id: "c", x: 4.0, z: 1.0 }),
    ];
    const moved = distributedPositions(uneven, "x");
    const xs = moved.map((position) => position.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(1.0, 6);
    expect(xs[2]).toBeCloseTo(4.0, 6);
    expect(xs[1] - xs[0]).toBeCloseTo(xs[2] - xs[1], 6);
  });

  it("works the same front-to-back, and leaves x alone", () => {
    const uneven = [
      item({ id: "a", x: 2.0, z: 0.5 }),
      item({ id: "b", x: 2.0, z: 0.7 }),
      item({ id: "c", x: 2.0, z: 2.9 }),
      item({ id: "d", x: 2.0, z: 3.0 }),
    ];
    const moved = distributedPositions(uneven, "z");
    const zs = moved.map((position) => position.z).sort((a, b) => a - b);
    const gaps = zs.slice(1).map((value, index) => +(value - zs[index]).toFixed(6));
    expect(new Set(gaps).size).toBe(1);
    expect(moved.every((position) => position.x === 2.0)).toBe(true);
  });

  it("orders by position, not by the order they were selected in", () => {
    const shuffled = [
      item({ id: "right", x: 4.0, z: 1.0 }),
      item({ id: "left", x: 1.0, z: 1.0 }),
      item({ id: "middle", x: 1.2, z: 1.0 }),
    ];
    const moved = distributedPositions(shuffled, "x");
    // The ends must not move however they arrived.
    expect(moved.find((position) => position.id === "left")!.x).toBeCloseTo(1.0, 6);
    expect(moved.find((position) => position.id === "right")!.x).toBeCloseTo(4.0, 6);
    expect(moved.find((position) => position.id === "middle")!.x).toBeCloseTo(2.5, 6);
  });

  it("has nothing between the ends with fewer than three items", () => {
    expect(distributedPositions([item({ id: "a" }), item({ id: "b" })], "x")).toEqual([]);
  });
});

describe("an arrangement that is not allowed", () => {
  // The refusal that was only ever seen in a browser: centring two items across
  // their own extent lands both on a front support column, and the workspace
  // applies all of an arrangement or none of it.
  const straddlers = [
    item({ id: "a", x: 2.6, z: 1.0, w: 0.5, d: 0.5 }),
    item({ id: "b", x: 3.4, z: 2.2, w: 0.5, d: 0.5 }),
  ];

  it("is legal where it starts", () => {
    expect(placementIssuesFor(straddlers, [], booth, [3])).toHaveLength(0);
  });

  it("is reported once the alignment would put it on a support column", () => {
    const moved = alignedPositions(straddlers, "centre-x");
    // Extent 2.35 to 3.65, so both centre on 3.0 - the column.
    expect(moved.every((position) => position.x === 3.0)).toBe(true);

    const arranged = straddlers.map((source) => {
      const position = moved.find((entry) => entry.id === source.id)!;
      return { ...source, x: position.x, z: position.z };
    });
    const issues = placementIssuesFor(arranged, [], booth, [3]);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((issue) => issue.message.includes("support rail"))).toBe(true);
    // Both of them, so the workspace refuses the whole arrangement rather than
    // moving one and leaving the other.
    expect(new Set(issues.map((issue) => issue.itemId))).toEqual(new Set(["a", "b"]));
  });
});
