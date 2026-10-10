import { describe, expect, it } from "vitest";
import { furnitureDiff } from "./PMProposalReview";

type Item = { id: string; catalogId: string; name: string; kind: string; x: number; z: number };

function item(over: Partial<Item> = {}): Item {
  return { id: "a", catalogId: "c", name: "Chair", kind: "furniture", x: 1, z: 1, ...over };
}

describe("furnitureDiff", () => {
  it("reports nothing when the layouts match", () => {
    const items = [item({ id: "a" }), item({ id: "b" })];
    expect(furnitureDiff(items, items).empty).toBe(true);
  });

  it("separates added, removed and moved pieces", () => {
    const before = [item({ id: "keep" }), item({ id: "gone" }), item({ id: "shift", x: 1 })];
    const after = [item({ id: "keep" }), item({ id: "new" }), item({ id: "shift", x: 2.5 })];
    const diff = furnitureDiff(before, after);

    expect(diff.added.map((i) => i.id)).toEqual(["new"]);
    expect(diff.removed.map((i) => i.id)).toEqual(["gone"]);
    expect(diff.moved.map((i) => i.id)).toEqual(["shift"]);
    expect(diff.empty).toBe(false);
  });

  it("ignores sub-centimetre drift, which is the grid rather than an intention", () => {
    const before = [item({ id: "a", x: 1, z: 1 })];
    const after = [item({ id: "a", x: 1.005, z: 1.004 })];
    expect(furnitureDiff(before, after).moved).toHaveLength(0);
  });

  it("ignores structure entirely, since a proposal can never change it", () => {
    // If structure ever showed up here it would read as the client's doing,
    // which would be a lie: the server rebuilds it from the PM's own version.
    const before = [item({ id: "w1", kind: "structure", x: 0 })];
    const after = [item({ id: "w1", kind: "structure", x: 5 }), item({ id: "w2", kind: "structure" })];
    const diff = furnitureDiff(before, after);

    expect(diff.added).toHaveLength(0);
    expect(diff.moved).toHaveLength(0);
    expect(diff.empty).toBe(true);
  });

  it("counts a piece the client both removed and re-added as added, not moved", () => {
    // Re-adding creates a new id, so there is no pairing to call a move.
    const before = [item({ id: "old-chair", x: 1 })];
    const after = [item({ id: "new-chair", x: 4 })];
    const diff = furnitureDiff(before, after);

    expect(diff.added.map((i) => i.id)).toEqual(["new-chair"]);
    expect(diff.removed.map((i) => i.id)).toEqual(["old-chair"]);
    expect(diff.moved).toHaveLength(0);
  });
});
