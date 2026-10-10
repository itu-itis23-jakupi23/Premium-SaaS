import { describe, expect, it } from "vitest";
import { ROOM_ITEM_PAD_M } from "@/lib/workspace-transform";
import {
  applyRoomLimits,
  availableRoomWallSides,
  findAvailableRoomPlacement,
  clampInsideRoom,
  clampItemToBooth,
  itemPositionBounds,
  placementIssuesFor,
  roomContainingPoint,
  roomPlacementIssue,
  roomInteriorBounds,
} from "./workspace-geometry";
import type { BoothState, WorkspacePlacedItem, WorkspaceRoom } from "./workspace-model";

/**
 * The clamps the renderer runs on every drag (WS-06, WS-07, WS-10).
 *
 * These four are the functions `booth-render.js` calls while an item is under
 * the cursor, so they run thousands of times per session and are the ones a
 * designer feels. They had no direct coverage: everything here was reached only
 * through the collision tests, which cannot see a clamp that stops an item one
 * pad short of legal.
 */

const booth: BoothState = {
  width: 6, depth: 3, height: 2.5, system: "octanorm", companyName: "Test",
  openFront: true, openBack: false, openLeft: false, openRight: false,
  fasciaEnabled: true, fasciaOption: "full",
};

function room(over: Partial<WorkspaceRoom> = {}): WorkspaceRoom {
  return {
    id: over.id ?? "r1", name: over.name ?? "Room", width: 2, depth: 2, height: 2.5,
    x: 1.5, z: 1.5, hasDoor: false, hasCeiling: false, doorSide: "front", doorWidth: 0.9,
    doorPosition: "center", doorSwing: "left-in", doorOpen: false, wallFinish: "white",
    floorColor: "#eee", locked: false, designWall: "front", designFit: "contain", ...over,
  };
}

function item(over: Partial<WorkspacePlacedItem> = {}): WorkspacePlacedItem {
  return {
    id: over.id ?? "i1", catalogId: "c", name: over.name ?? "Item", sku: "s", qty: 1,
    w: 0.5, d: 0.5, h: 1, color: "#000", weight: 10, x: 3, z: 1.5, rotation: 0,
    kind: "furniture", shape: "box", ...over,
  };
}

describe("clampItemToBooth", () => {
  it("leaves a position that is already legal alone", () => {
    expect(clampItemToBooth(booth, 3, 1.5, 0.5, 0.5)).toEqual({ x: 3, z: 1.5 });
  });

  it("pulls a far-away drop back to the edge of the drawable plan", () => {
    const bounds = itemPositionBounds(0.5, 0.5, booth);
    const far = clampItemToBooth(booth, 9999, 9999, 0.5, 0.5);

    expect(far.x).toBeCloseTo(bounds.maxX, 6);
    expect(far.z).toBeCloseTo(bounds.maxZ, 6);

    const near = clampItemToBooth(booth, -9999, -9999, 0.5, 0.5);
    expect(near.x).toBeCloseTo(bounds.minX, 6);
    expect(near.z).toBeCloseTo(bounds.minZ, 6);
  });

  it("gives a wide item a narrower range than a small one", () => {
    const small = itemPositionBounds(0.3, 0.3, booth);
    const wide = itemPositionBounds(2.5, 0.3, booth);
    expect(wide.maxX).toBeLessThan(small.maxX);
    expect(wide.minX).toBeGreaterThan(small.minX);
  });

  it("never returns NaN for a coordinate the renderer could not compute", () => {
    // A raycast that misses the floor yields NaN, and a NaN position propagates
    // into the saved layout where nothing can render it.
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const at = clampItemToBooth(booth, bad, bad, 0.5, 0.5);
      expect(Number.isFinite(at.x)).toBe(true);
      expect(Number.isFinite(at.z)).toBe(true);
    }
  });
});

describe("roomContainingPoint", () => {
  const store = room({ id: "s", x: 1.5, z: 1.5, width: 2, depth: 2 });

  it("finds the room a point stands in", () => {
    expect(roomContainingPoint([store], 1.5, 1.5)?.id).toBe("s");
  });

  it("returns nothing out on the open floor", () => {
    expect(roomContainingPoint([store], 5, 1.5)).toBeNull();
  });

  it("counts the boundary itself as inside", () => {
    // The wall line belongs to the room: a drag landing exactly on it should be
    // clamped by the room rather than treated as open floor.
    expect(roomContainingPoint([store], 0.5, 1.5)?.id).toBe("s");
    expect(roomContainingPoint([store], 2.5, 1.5)?.id).toBe("s");
  });

  it("has nothing to find when no rooms are drawn", () => {
    expect(roomContainingPoint([], 1.5, 1.5)).toBeNull();
  });
});

describe("clampInsideRoom", () => {
  const store = room({ id: "s", x: 1.5, z: 1.5, width: 2, depth: 2 });

  it("slides an item along the wall it is pushed against", () => {
    const at = clampInsideRoom(store, 99, 1.5, 0.5, 0.5);
    const interior = roomInteriorBounds(store);
    expect(at.x).toBeLessThan(interior.x1);
    // Pushed only on the axis it was pushed on.
    expect(at.z).toBeCloseTo(1.5, 6);
  });

  /**
   * The invariant the clamp exists for, and the one the module's own comment
   * warns about: clamping and checking have to inset by the same amount. Clamp
   * to the bare interior and an item stops against the wall while still being
   * reported as crossing it — legal nowhere, which is the bug this pins.
   */
  it("lands somewhere the collision check then calls legal", () => {
    for (const [px, pz] of [[99, 99], [-99, -99], [99, -99], [-99, 99], [1.5, 99]]) {
      const at = clampInsideRoom(store, px, pz, 0.5, 0.5);
      const issues = placementIssuesFor(
        [item({ id: "a", x: at.x, z: at.z, w: 0.5, d: 0.5 })],
        [store], booth, [],
      );
      expect(issues, `clamped to ${at.x},${at.z} from ${px},${pz}`).toHaveLength(0);
    }
  });

  it("centres an item too big for the room rather than clamping it to nothing", () => {
    // It cannot fit, so there is no legal spot to slide to. Centring at least
    // lands it somewhere the designer can see and the issue list can report.
    const at = clampInsideRoom(store, 99, 99, 5, 5);
    expect(at.x).toBeCloseTo(store.x, 6);
    expect(at.z).toBeCloseTo(store.z, 6);
  });

  it("keeps the padding the collision check also applies", () => {
    const interior = roomInteriorBounds(store);
    const at = clampInsideRoom(store, 99, 1.5, 0.5, 0.5);
    // Half the item, plus the pad, short of the interior wall.
    expect(at.x).toBeCloseTo(interior.x1 - 0.25 - ROOM_ITEM_PAD_M, 6);
  });
});

describe("applyRoomLimits", () => {
  const store = room({ id: "s", x: 1.5, z: 1.5, width: 2, depth: 2 });

  it("changes nothing when no rooms are drawn", () => {
    expect(applyRoomLimits([], 3, 1.5, 0.5, 0.5)).toEqual({ x: 3, z: 1.5 });
  });

  it("leaves an item that is already clear of every room alone", () => {
    expect(applyRoomLimits([store], 5, 1.5, 0.5, 0.5)).toEqual({ x: 5, z: 1.5 });
  });

  it("holds an item that is inside the room inside it", () => {
    // A point *inside* the walls. A far-away one is not the same case: it
    // overlaps nothing, so applyRoomLimits leaves it exactly where it is, and
    // asserting otherwise tests a rule that does not exist.
    const at = applyRoomLimits([store], 2.4, 1.5, 0.5, 0.5);
    const interior = roomInteriorBounds(store);
    expect(at.x).toBeLessThan(interior.x1);
    expect(at.x).toBeCloseTo(interior.x1 - 0.25 - ROOM_ITEM_PAD_M, 6);
    expect(roomContainingPoint([store], at.x, at.z)?.id).toBe("s");
  });

  it("pushes an item overlapping from outside back out, not through", () => {
    // Approaching from the right: it should end up to the right of the room,
    // never teleported to the far side of it.
    const at = applyRoomLimits([store], 2.6, 1.5, 0.5, 0.5);
    expect(at.x).toBeGreaterThan(2.5);
    expect(at.z).toBeCloseTo(1.5, 6);
  });

  it("takes the shorter way out when a corner is ambiguous", () => {
    // Just inside the top-right corner from outside: the smaller overlap wins,
    // so the item slides around the room rather than across it.
    const at = applyRoomLimits([store], 2.55, 2.4, 0.5, 0.5);
    const movedX = Math.abs(at.x - 2.55);
    const movedZ = Math.abs(at.z - 2.4);
    expect(movedX > 0 || movedZ > 0).toBe(true);
    expect(Math.min(movedX, movedZ)).toBeCloseTo(0, 6);
  });

  it("settles clear of every room when two sit side by side", () => {
    const a = room({ id: "a", x: 1.5, z: 1.5, width: 2, depth: 2 });
    const b = room({ id: "b", x: 4.2, z: 1.5, width: 2, depth: 2 });
    const at = applyRoomLimits([a, b], 2.9, 1.5, 0.5, 0.5);
    expect(roomContainingPoint([a, b], at.x, at.z)).toBeNull();
  });
});

describe("availableRoomWallSides", () => {
  // A door has to open into something. A wall flush against a closed booth side
  // has nowhere to swing, so that side must not be offered.
  const closedSides: BoothState = { ...booth, openFront: false, openBack: false, openLeft: false, openRight: false };

  it("offers every side to a room standing clear in the middle", () => {
    const sides = availableRoomWallSides(2, 1, 3, 1.5, closedSides);
    expect(sides).toEqual(expect.arrayContaining(["front", "back", "left", "right"]));
  });

  it("withholds the side a room is pushed flush against", () => {
    // Hard against the back wall (z = 0) of a booth whose back is closed.
    const sides = availableRoomWallSides(2, 1, 3, 0.5, closedSides);
    expect(sides).not.toContain("back");
    expect(sides).toContain("front");
  });

  it("offers a flush side anyway when the booth is open there", () => {
    // An open side is aisle, so a door can face it however close the room sits.
    const sides = availableRoomWallSides(2, 1, 3, 0.5, { ...closedSides, openBack: true });
    expect(sides).toContain("back");
  });

  it("withholds both ends for a room spanning the full depth", () => {
    const sides = availableRoomWallSides(2, 3, 3, 1.5, closedSides);
    expect(sides).not.toContain("front");
    expect(sides).not.toContain("back");
  });
});

describe("findAvailableRoomPlacement", () => {
  it("searches from a corner rather than keeping the position it was handed", () => {
    // Worth stating because the name suggests otherwise: this does not try the
    // room's current spot first. It walks a candidate list that starts at the
    // corners, so a caller must treat the result as a *new* position, not as a
    // confirmation that the old one was fine.
    const store = room({ id: "s", x: 1.5, z: 1.5, width: 2, depth: 2 });
    const at = findAvailableRoomPlacement(store, [], [], booth);

    expect(at).not.toBeNull();
    expect({ x: at!.x, z: at!.z }).toEqual({ x: store.width / 2, z: store.depth / 2 });
    expect({ x: at!.x, z: at!.z }).not.toEqual({ x: store.x, z: store.z });
  });

  it("gives back the whole room, not just a coordinate", () => {
    // Callers spread the result straight over state; returning a bare point
    // would silently drop the door, finish and lock settings.
    const store = room({ id: "s", name: "Store", x: 1.5, z: 1.5, hasDoor: true, doorSide: "left" });
    const at = findAvailableRoomPlacement(store, [], [], booth);

    expect(at).not.toBeNull();
    expect(at!.id).toBe("s");
    expect(at!.name).toBe("Store");
    expect(at!.hasDoor).toBe(true);
    expect(at!.doorSide).toBe("left");
  });

  it("gives up rather than overlapping when nothing fits", () => {
    // A room as big as the booth, with the booth already full of one.
    const whole = room({ id: "a", x: 3, z: 1.5, width: 6, depth: 3 });
    const incoming = room({ id: "b", x: 3, z: 1.5, width: 6, depth: 3 });
    expect(findAvailableRoomPlacement(incoming, [whole], [], booth)).toBeNull();
  });

  it("finds a spot clear of a room already drawn", () => {
    const existing = room({ id: "a", x: 1.5, z: 1.5, width: 2, depth: 2 });
    const incoming = room({ id: "b", x: 1.5, z: 1.5, width: 2, depth: 2 });
    const at = findAvailableRoomPlacement(incoming, [existing], [], booth);

    expect(at).not.toBeNull();
    // Whatever it picked must not overlap the one already there.
    const placed = { ...incoming, ...at! };
    expect(roomPlacementIssue(placed, [existing, placed], [])).toBe("");
  });

  it("keeps the room inside the booth it is placed in", () => {
    const incoming = room({ id: "b", x: 99, z: 99, width: 2, depth: 2 });
    const at = findAvailableRoomPlacement(incoming, [], [], booth);

    expect(at).not.toBeNull();
    expect(at!.x).toBeGreaterThanOrEqual(incoming.width / 2);
    expect(at!.x).toBeLessThanOrEqual(booth.width - incoming.width / 2);
    expect(at!.z).toBeGreaterThanOrEqual(incoming.depth / 2);
    expect(at!.z).toBeLessThanOrEqual(booth.depth - incoming.depth / 2);
  });
});
