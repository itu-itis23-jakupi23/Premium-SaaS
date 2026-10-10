import { ROOM_SIDE_OPTIONS, type BoothState, type DoorSide, type WorkspacePlacedItem, type WorkspaceRoom } from "./workspace-model";
import {
  ITEM_WALL_CLEARANCE_M,
  PLAN_MARGIN_M,
  ROOM_ITEM_PAD_M,
  ROOM_WALL_CLEARANCE_M,
  snapNumber,
} from "@/lib/workspace-transform";

// Pure 2D placement/collision geometry for the booth workspace, split out of
// PMWorkspace.tsx. No React, no component state — just math on booth/item/room
// shapes. Kept in one module so the placement rules live in one testable place.

export type PlacementIssue = { itemId: string; message: string };
type Rect2D = { x0: number; x1: number; z0: number; z1: number };

export function itemPositionBounds(w: number, d: number, booth: BoothState) {
  // The plan around the stand is placeable, not just the footprint - a screen
  // or a totem facing the aisle belongs outside the walls, and stopping at the
  // footprint meant it could not be drawn at all.
  const clearance = ITEM_WALL_CLEARANCE_M;
  const margin = PLAN_MARGIN_M;
  const minX = Math.min(booth.width / 2, w / 2 + clearance - margin);
  const maxX = Math.max(minX, booth.width - w / 2 - clearance + margin);
  const minZ = Math.min(booth.depth / 2, d / 2 + clearance - margin);
  const maxZ = Math.max(minZ, booth.depth - d / 2 - clearance + margin);
  return { minX, maxX, minZ, maxZ };
}

export function rotatedItemFootprint(item: WorkspacePlacedItem) {
  const radians = ((Number(item.rotationY ?? item.rotation) || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    width: item.w * cos + item.d * sin,
    depth: item.w * sin + item.d * cos,
  };
}

export function positionBoundsForItem(item: WorkspacePlacedItem, booth: BoothState) {
  const footprint = rotatedItemFootprint(item);
  return itemPositionBounds(footprint.width, footprint.depth, booth);
}

function itemRect(item: WorkspacePlacedItem, pad = ROOM_ITEM_PAD_M): Rect2D {
  const footprint = rotatedItemFootprint(item);
  return {
    x0: item.x - footprint.width / 2 - pad,
    x1: item.x + footprint.width / 2 + pad,
    z0: item.z - footprint.depth / 2 - pad,
    z1: item.z + footprint.depth / 2 + pad,
  };
}

function roomRect(room: WorkspaceRoom, pad = 0.03): Rect2D {
  return {
    x0: room.x - room.width / 2 - pad,
    x1: room.x + room.width / 2 + pad,
    z0: room.z - room.depth / 2 - pad,
    z1: room.z + room.depth / 2 + pad,
  };
}

function rectsOverlap(a: Rect2D, b: Rect2D) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
}

function rectInside(inner: Rect2D, outer: Rect2D, tolerance = 0.001) {
  return inner.x0 >= outer.x0 - tolerance
    && inner.x1 <= outer.x1 + tolerance
    && inner.z0 >= outer.z0 - tolerance
    && inner.z1 <= outer.z1 + tolerance;
}

function roomInteriorRect(room: WorkspaceRoom): Rect2D {
  const clearance = ROOM_WALL_CLEARANCE_M;
  const outer = roomRect(room, 0);
  return {
    x0: Math.min(room.x, outer.x0 + clearance),
    x1: Math.max(room.x, outer.x1 - clearance),
    z0: Math.min(room.z, outer.z0 + clearance),
    z1: Math.max(room.z, outer.z1 - clearance),
  };
}

function roomDoorAxisCenter(room: WorkspaceRoom) {
  const usesDepth = room.doorSide === 'left' || room.doorSide === 'right';
  const span = usesDepth ? room.depth : room.width;
  const start = usesDepth ? room.z - room.depth / 2 : room.x - room.width / 2;
  const sectionCount = Math.max(1, Math.floor(span));
  const sectionWidth = span / sectionCount;
  const index = room.doorPosition === 'left' ? 0 : room.doorPosition === 'right' ? sectionCount - 1 : Math.round((sectionCount - 1) / 2);
  return start + sectionWidth * (index + 0.5);
}

function roomDoorClearanceRect(room: WorkspaceRoom): Rect2D | null {
  if (!room.hasDoor) return null;
  const center = roomDoorAxisCenter(room);
  const halfOpening = room.doorWidth / 2 + 0.08;
  const swingDepth = Math.max(0.75, room.doorWidth + 0.12);
  const outer = roomRect(room, 0);
  if (room.doorSide === 'back') return { x0: center - halfOpening, x1: center + halfOpening, z0: outer.z0 - 0.06, z1: outer.z0 + swingDepth };
  if (room.doorSide === 'left') return { x0: outer.x0 - 0.06, x1: outer.x0 + swingDepth, z0: center - halfOpening, z1: center + halfOpening };
  if (room.doorSide === 'right') return { x0: outer.x1 - swingDepth, x1: outer.x1 + 0.06, z0: center - halfOpening, z1: center + halfOpening };
  return { x0: center - halfOpening, x1: center + halfOpening, z0: outer.z1 - swingDepth, z1: outer.z1 + 0.06 };
}

function roomItemConflict(itemBounds: Rect2D, room: WorkspaceRoom): 'wall' | 'door' | null {
  if (!rectsOverlap(itemBounds, roomRect(room, 0))) return null;
  if (!rectInside(itemBounds, roomInteriorRect(room))) return 'wall';
  const doorClearance = roomDoorClearanceRect(room);
  return doorClearance && rectsOverlap(itemBounds, doorClearance) ? 'door' : null;
}

export function roomPlacementIssue(candidate: WorkspaceRoom, allRooms: WorkspaceRoom[], items: WorkspacePlacedItem[]) {
  for (const other of allRooms) {
    if (other.id === candidate.id) continue;
    if (rectsOverlap(roomRect(candidate, 0.04), roomRect(other, 0.04))) return `Overlaps ${other.name}`;
  }
  for (const item of items.filter(isFloorPlacedItem)) {
    const conflict = roomItemConflict(itemRect(item), candidate);
    if (conflict === 'wall') return `${item.name} crosses a room wall`;
    if (conflict === 'door') return `${item.name} blocks the door clearance`;
  }
  return '';
}

export function findAvailableRoomPlacement(room: WorkspaceRoom, rooms: WorkspaceRoom[], items: WorkspacePlacedItem[], booth: BoothState) {
  const minX = room.width / 2;
  const maxX = Math.max(minX, booth.width - room.width / 2);
  const minZ = room.depth / 2;
  const maxZ = Math.max(minZ, booth.depth - room.depth / 2);
  const candidates: { x: number; z: number }[] = [
    { x: minX, z: minZ }, { x: maxX, z: minZ }, { x: minX, z: maxZ }, { x: maxX, z: maxZ },
    { x: booth.width / 2, z: booth.depth / 2 },
  ];
  for (let z = minZ; z <= maxZ + 0.001; z += 0.5) {
    for (let x = minX; x <= maxX + 0.001; x += 0.5) candidates.push({ x: snapNumber(x), z: snapNumber(z) });
  }
  for (const position of candidates) {
    const candidate = { ...room, ...position };
    if (!roomPlacementIssue(candidate, rooms, items)) return candidate;
  }
  return null;
}

function isFloorPlacedItem(item: WorkspacePlacedItem) {
  return (item.kind === 'furniture' || item.kind === 'asset') && item.shape !== 'wall_shelf' && item.shape !== 'light' && item.shape !== 'rail_light';
}

export function placementIssuesFor(items: WorkspacePlacedItem[], rooms: WorkspaceRoom[], booth: BoothState, frontSupports: number[]): PlacementIssue[] {
  const issues: PlacementIssue[] = [];
  const floorItems = items.filter(isFloorPlacedItem);
  const seen = new Set<string>();
  const addIssue = (itemId: string, message: string) => {
    const key = `${itemId}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    issues.push({ itemId, message });
  };

  for (let i = 0; i < floorItems.length; i += 1) {
    const a = floorItems[i];
    const aRect = itemRect(a);
    for (let j = i + 1; j < floorItems.length; j += 1) {
      const b = floorItems[j];
      if (!rectsOverlap(aRect, itemRect(b))) continue;
      addIssue(a.id, `Overlaps ${b.name}`);
      addIssue(b.id, `Overlaps ${a.name}`);
    }
    for (const room of rooms) {
      const conflict = roomItemConflict(aRect, room);
      if (conflict === 'wall') addIssue(a.id, `Crosses ${room.name} wall`);
      if (conflict === 'door') addIssue(a.id, `Blocks ${room.name} door clearance`);
    }
    const bounds = itemPositionBounds(rotatedItemFootprint(a).width, rotatedItemFootprint(a).depth, booth);
    if (a.x < bounds.minX || a.x > bounds.maxX || a.z < bounds.minZ || a.z > bounds.maxZ) {
      addIssue(a.id, 'Outside the usable plan area');
    }
    for (const supportX of frontSupports) {
      const supportLane: Rect2D = {
        x0: supportX - 0.12,
        x1: supportX + 0.12,
        z0: 0,
        z1: booth.depth,
      };
      if (rectsOverlap(aRect, supportLane)) addIssue(a.id, 'Blocks a structural support rail');
    }
  }
  return issues;
}

// Which sides of a room actually get a built wall: a room edge flush with the
// booth shell borrows that shell wall instead of getting its own. Drives both
// the door-side options and the room material take-off.
//
// A side can only be borrowed if the shell has a wall on it. An open side is a
// frame with no panel in it, so a room pushed against one builds its own wall
// there like anywhere else - and gets charged for it. Reading the flush test
// alone left a storeroom standing open to the aisle, with nothing on the
// take-off for the wall that was missing.
export function availableRoomWallSides(width: number, depth: number, x: number, z: number, booth: BoothState): DoorSide[] {
  const tolerance = 0.02;
  return ROOM_SIDE_OPTIONS.map(option => option.value).filter(side => {
    if (side === 'back') return booth.openBack || z - depth / 2 > tolerance;
    if (side === 'front') return booth.openFront || z + depth / 2 < booth.depth - tolerance;
    if (side === 'left') return booth.openLeft || x - width / 2 > tolerance;
    return booth.openRight || x + width / 2 < booth.width - tolerance;
  });
}

/* ── The renderer's half, now living here too ──────────────────────────────
 *
 * Everything below was implemented a second time in booth-render.js, in booth-
 * centred coordinates, untyped, with twenty-five call sites. The two copies
 * drifted: they measured room interiors differently until recently, and they
 * still disagreed on how much daylight two items need between them - the
 * renderer let go at 2 cm and this module refused under 6 cm, so a drag could
 * put something down that the workspace then rejected with no explanation.
 *
 * One implementation now. The renderer loads a compiled copy of this file and
 * calls these; it keeps only the coordinate shift (it draws the booth centred
 * on the origin, this module measures from the front-left corner) and the
 * things that are genuinely about drawing - wall mounting, drag state, rails.
 *
 * Everything here is pure and takes the world it needs as an argument, because
 * the renderer's world lives in globals that this module must never see.
 */

/** The world a placement is judged against. */
export interface PlacementWorld {
  items: WorkspacePlacedItem[];
  rooms: WorkspaceRoom[];
  booth: BoothState;
  frontSupports: number[];
}

/** A footprint standing at a point, in workspace coordinates. */
export interface Footprint {
  x: number;
  z: number;
  w: number;
  d: number;
  rotationY?: number;
}

function footprintRect(shape: Footprint, pad = ROOM_ITEM_PAD_M): Rect2D {
  const size = rotatedItemFootprint({ w: shape.w, d: shape.d, rotationY: shape.rotationY ?? 0 } as WorkspacePlacedItem);
  return {
    x0: shape.x - size.width / 2 - pad,
    x1: shape.x + size.width / 2 + pad,
    z0: shape.z - size.depth / 2 - pad,
    z1: shape.z + size.depth / 2 + pad,
  };
}

/**
 * Why an item standing on this footprint conflicts with `room`, or '' when it
 * does not.
 *
 * The item-shaped view of roomPlacementReason(): that one asks whether a room
 * may move onto the items already placed, this one whether an item may move
 * into a room already drawn. Both answer from roomItemConflict(), so a drop
 * preview and the workspace that accepts the drop cannot disagree about what
 * is allowed - which is the whole reason this lives here and not in a renderer.
 *
 * Pass a footprint that has already been rotated only if you leave rotationY
 * off; footprintRect() rotates what it is given, so supplying both turns the
 * box twice.
 */
export function roomItemPlacementReason(shape: Footprint, room: WorkspaceRoom): string {
  const conflict = roomItemConflict(footprintRect(shape), room);
  if (conflict === 'wall') return `Crosses ${String(room.name || 'room')} wall`;
  if (conflict === 'door') return `Blocks ${String(room.name || 'room')} door clearance`;
  return '';
}

/** The box an item has to sit inside to count as being in this room. */
export function roomInteriorBounds(room: WorkspaceRoom): Rect2D {
  return roomInteriorRect(room);
}

/** The room whose footprint contains (x, z), or null out on the stand floor. */
export function roomContainingPoint(rooms: WorkspaceRoom[], x: number, z: number): WorkspaceRoom | null {
  for (const room of rooms) {
    const outer = roomRect(room, 0);
    if (x >= outer.x0 && x <= outer.x1 && z >= outer.z0 && z <= outer.z1) return room;
  }
  return null;
}

/**
 * Holds a footprint inside a room's walls.
 *
 * What makes a room's walls a limit rather than a warning: an item dragged
 * inside one slides along the wall it is pushed against instead of crossing it.
 * A footprint too big for the room is centred rather than clamped to nothing,
 * so it lands somewhere sensible and the collision check can still report it.
 */
export function clampInsideRoom(room: WorkspaceRoom, x: number, z: number, w: number, d: number) {
  const interior = roomInteriorRect(room);
  // The pad, as well as the interior. roomItemConflict() tests a *padded*
  // footprint against this same rect, so clamping to the bare interior lands an
  // item one pad-width short of legal - it stops against the wall and is still
  // reported as crossing it. Clamp and check have to inset by the same amount.
  const spareX = (interior.x1 - interior.x0 - Math.max(0.06, w) - ROOM_ITEM_PAD_M * 2) / 2;
  const spareZ = (interior.z1 - interior.z0 - Math.max(0.06, d) - ROOM_ITEM_PAD_M * 2) / 2;
  const cx = (interior.x0 + interior.x1) / 2;
  const cz = (interior.z0 + interior.z1) / 2;
  return {
    x: spareX <= 0 ? cx : Math.max(cx - spareX, Math.min(cx + spareX, x)),
    z: spareZ <= 0 ? cz : Math.max(cz - spareZ, Math.min(cz + spareZ, z)),
  };
}

/**
 * Makes every room's walls solid in both directions: something inside slides
 * along the inside of the wall it is pushed against, something outside slides
 * along the outside.
 *
 * Drag and drop only. Drawing must never call this - a renderer that relocates
 * what it draws is how furniture used to slide out of corners.
 */
export function applyRoomLimits(rooms: WorkspaceRoom[], x: number, z: number, w: number, d: number) {
  if (!rooms.length) return { x, z };
  const inside = roomContainingPoint(rooms, x, z);
  if (inside) return clampInsideRoom(inside, x, z, w, d);
  let outX = x;
  let outZ = z;
  for (const room of rooms) {
    const outer = roomRect(room, 0);
    const cx = (outer.x0 + outer.x1) / 2;
    const cz = (outer.z0 + outer.z1) / 2;
    const reachX = (outer.x1 - outer.x0) / 2 + Math.max(0.06, w) / 2 + ROOM_ITEM_PAD_M;
    const reachZ = (outer.z1 - outer.z0) / 2 + Math.max(0.06, d) / 2 + ROOM_ITEM_PAD_M;
    const dx = outX - cx;
    const dz = outZ - cz;
    const overlapX = reachX - Math.abs(dx);
    const overlapZ = reachZ - Math.abs(dz);
    if (overlapX <= 0 || overlapZ <= 0) continue;
    // Out along whichever axis is the shorter way out, so the item slides
    // around the room rather than jumping to the far side of it.
    if (overlapX <= overlapZ) outX = cx + (dx < 0 ? -reachX : reachX);
    else outZ = cz + (dz < 0 ? -reachZ : reachZ);
  }
  return { x: outX, z: outZ };
}

/** Holds a footprint inside the drawable plan around the stand. */
export function clampItemToBooth(booth: BoothState, x: number, z: number, w: number, d: number) {
  const bounds = itemPositionBounds(w, d, booth);
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, Number(x) || 0)),
    z: Math.max(bounds.minZ, Math.min(bounds.maxZ, Number(z) || 0)),
  };
}

/**
 * Things furniture cannot be built through.
 *
 * Exactly one: the front support column, which stands in the open span with
 * nothing behind it to push against. The frame is not on this list - a corner
 * unit is a real product and a corner is where it goes.
 */
export function structuralObstacles(booth: BoothState, frontSupports: number[]): Rect2D[] {
  return frontSupports.map(supportX => ({
    x0: supportX - 0.12,
    x1: supportX + 0.12,
    z0: 0,
    z1: booth.depth,
  }));
}

/**
 * Why a footprint cannot stand at this spot, or '' when it can.
 *
 * The single source for both halves. The renderer shows the sentence on the
 * drag gizmo; the workspace turns it into a placement issue.
 */
export function placementReason(world: PlacementWorld, excludeId: string | null, shape: Footprint): string {
  const rect = footprintRect(shape);
  for (const zone of structuralObstacles(world.booth, world.frontSupports)) {
    if (rectsOverlap(rect, zone)) return "Blocked by a booth support";
  }
  for (const other of world.items) {
    if (excludeId != null && String(other.id) === String(excludeId)) continue;
    if (!isFloorPlacedItem(other)) continue;
    if (rectsOverlap(rect, itemRect(other))) return `Overlaps ${String(other.name || "another item")}`;
  }
  for (const room of world.rooms) {
    const conflict = roomItemConflict(rect, room);
    if (conflict === "wall") return `Crosses ${String(room.name || "room")} wall`;
    if (conflict === "door") return `Blocks ${String(room.name || "room")} door clearance`;
  }
  return "";
}

/** Why a room cannot stand where it is being put, or '' when it can. */
export function roomPlacementReason(candidate: WorkspaceRoom, rooms: WorkspaceRoom[], items: WorkspacePlacedItem[]): string {
  for (const other of rooms) {
    if (String(other.id) === String(candidate.id)) continue;
    if (rectsOverlap(roomRect(candidate, 0.04), roomRect(other, 0.04))) {
      return `Overlaps ${String(other.name || "another room")}`;
    }
  }
  for (const item of items) {
    if (!isFloorPlacedItem(item)) continue;
    const conflict = roomItemConflict(itemRect(item), candidate);
    if (conflict === "wall") return `Crosses ${String(candidate.name || "room")} wall`;
    if (conflict === "door") return `Blocks ${String(candidate.name || "room")} door clearance`;
  }
  return "";
}

/* ── Arranging a selection ─────────────────────────────────────────────────
 *
 * The six alignments and the two distributions, as data in and data out. They
 * lived inline in PMWorkspace.tsx, closing over `ws` and `commit`, which put
 * them out of reach of the test suite - the only thing that had ever exercised
 * them was a browser.
 *
 * These decide *where things should go*, and nothing else. Whether the result
 * is allowed is a separate question, answered by placementIssuesFor() on the
 * whole arrangement, and whether it is kept is the caller's: the workspace
 * applies all of the returned positions or none of them, because half an
 * alignment is worse than none when the designer cannot see what was skipped.
 *
 * Locked items are the caller's business too. It passes in the items that are
 * allowed to move, and a locked one is simply not among them - so it does not
 * shift, and it does not drag the group's extent around either.
 */

/** Which edge of the selection's own extent to line up on. */
export type AlignEdge = 'left' | 'right' | 'centre-x' | 'front' | 'back' | 'centre-z';

/** The least an arrangement needs to know about an item. */
export type ArrangeItem = Pick<WorkspacePlacedItem, 'id' | 'x' | 'z' | 'w' | 'd'>
  & Partial<Pick<WorkspacePlacedItem, 'rotationY' | 'rotation'>>;

/** Where one item should end up. */
export interface ArrangedPosition {
  id: string;
  x: number;
  z: number;
}

function footprintOf(item: ArrangeItem) {
  return rotatedItemFootprint(item as WorkspacePlacedItem);
}

/**
 * Line a selection up on one edge of its own extent.
 *
 * To its own extent, not to the booth: someone lining furniture up is lining it
 * up with itself. Fewer than two items has no extent to speak of and returns
 * nothing to do.
 *
 * Edges land on the grid, not on the arithmetic. Centring puts every item on
 * one coordinate, so they all snap together and stay flush; aligning left or
 * right gives each item its own target (the extent, plus its own half-width),
 * so two items of different sizes can finish up to a grid step apart. Same
 * reason as distributedPositions() below - the grid wins, deliberately.
 */
export function alignedPositions(items: ArrangeItem[], edge: AlignEdge): ArrangedPosition[] {
  if (items.length < 2) return [];
  const alongX = edge === 'left' || edge === 'right' || edge === 'centre-x';
  const halfOf = (item: ArrangeItem) => (alongX ? footprintOf(item).width : footprintOf(item).depth) / 2;
  const centreOf = (item: ArrangeItem) => (alongX ? item.x : item.z);
  const low = Math.min(...items.map(item => centreOf(item) - halfOf(item)));
  const high = Math.max(...items.map(item => centreOf(item) + halfOf(item)));
  const mid = (low + high) / 2;
  const target = (item: ArrangeItem) => {
    const half = halfOf(item);
    if (edge === 'left' || edge === 'back') return low + half;
    if (edge === 'right' || edge === 'front') return high - half;
    return mid;
  };
  return items.map(item => ({
    id: item.id,
    x: alongX ? target(item) : item.x,
    z: alongX ? item.z : target(item),
  }));
}

/**
 * Even gaps between the outermost two, along one axis.
 *
 * The ends stay where they are and everything between them is respaced, which
 * is what "space these evenly" means to someone who has already placed the two
 * that matter. Fewer than three items has nothing between the ends.
 *
 * The gaps returned here are exactly even, in metres. The applied gaps usually
 * are not, and that is on purpose.
 *
 * The workspace snaps every position to the furniture grid on the way in, so
 * four items spread over 1.95 m come out as 0.65 / 0.60 / 0.65 rather than
 * three gaps of 0.65 - each item lands on the nearest 5 cm, and the remainder
 * has to go somewhere. This was measured during the align/distribute extraction
 * and kept: an item off the grid cannot be reached again by dragging, by the
 * arrow keys, or by anything else in the workspace, so exact spacing would buy
 * a tidier number at the cost of furniture that no longer lines up with
 * everything around it.
 *
 * Do not "fix" this by rounding the step, by snapping the span first, or by
 * exempting distribute from the grid. If the variance ever needs to be smaller,
 * the grid is the thing to change - FURNITURE_SNAP_M in workspace-transform.ts,
 * which check-transform-constants keeps in step with the renderer. The workspace
 * tells the designer what happened when it distributes; see distributeItems().
 */
export function distributedPositions(items: ArrangeItem[], axis: 'x' | 'z'): ArrangedPosition[] {
  if (items.length < 3) return [];
  const centreOf = (item: ArrangeItem) => (axis === 'x' ? item.x : item.z);
  const ordered = [...items].sort((a, b) => centreOf(a) - centreOf(b));
  const first = centreOf(ordered[0]);
  const last = centreOf(ordered[ordered.length - 1]);
  const step = (last - first) / (ordered.length - 1);
  return ordered.map((item, index) => ({
    id: item.id,
    x: axis === 'x' ? first + step * index : item.x,
    z: axis === 'x' ? item.z : first + step * index,
  }));
}
